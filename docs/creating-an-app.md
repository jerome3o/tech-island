# Creating a New App

This guide is for Claude Code agents (or humans!) creating new applications.

## Quick Start

1. Copy the template:
   ```bash
   cp -r apps/_template apps/my-new-app
   ```

2. Update files:
   - Rename references from `app-template` to `my-new-app`
   - Update `CLAUDE.md` with app description
   - Implement your app in `src/`

3. Update k8s manifests:
   - Change all `app-template` references to `my-new-app`
   - Update the ingress hostname

4. Commit and push to main:
   ```bash
   git add apps/my-new-app
   git commit -m "Add my-new-app"
   git push origin main
   ```

5. GitHub Actions will automatically build and deploy.

## Detailed Guide

### Step 1: Create App Directory

```bash
# Copy template
cp -r apps/_template apps/my-app

# Or create from scratch
mkdir -p apps/my-app/{src,k8s}
```

### Step 2: Write the CLAUDE.md

Every app MUST have a `CLAUDE.md` file. This provides context for any agent that works on the app later.

Include:
- What the app does
- Tech stack
- How to run locally
- API endpoints
- Database schema (if applicable)
- Known issues

### Step 3: Implement the App

Choose your tech stack:

**Node.js (recommended for quick apps)**
```javascript
// src/index.js
const express = require('express');
const app = express();

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/hello', (req, res) => {
  const user = req.headers['x-auth-request-user'];
  res.json({ message: `Hello ${user}!` });
});

app.listen(3000);
```

**Python (FastAPI)**
```python
# src/main.py
from fastapi import FastAPI, Header

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/hello")
def hello(x_auth_request_user: str = Header(default="anonymous")):
    return {"message": f"Hello {x_auth_request_user}!"}
```

### Step 4: Create the Dockerfile

Example for Node.js:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
```

Example for Python:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
USER nobody
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 5: Create Kubernetes Manifests

You need three files in `k8s/`:

**deployment.yaml** - Runs your container
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: REGISTRY_URL/my-app:IMAGE_TAG
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
```

**service.yaml** - Exposes your container
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: my-app
```

**ingress.yaml** - Routes traffic from internet
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.oauth2-proxy.svc.cluster.local:4180/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://$host/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User"
spec:
  ingressClassName: nginx
  rules:
    - host: my-app.INGRESS_IP.nip.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

### Step 6: Test Locally (Optional)

```bash
cd apps/my-app

# Install dependencies
npm install

# Run
npm run dev

# Test
curl http://localhost:3000/health
curl http://localhost:3000/api/hello
```

### Step 7: Deploy

```bash
git add apps/my-app
git commit -m "Add my-app: brief description"
git push origin main
```

Watch the deployment in GitHub Actions.

## Working with Databases

If your app needs a database:

1. Request a database name (use your app name)
2. Connection string will be provided via `DATABASE_URL` env var
3. Add the secret reference in deployment.yaml

Example database migration pattern:
```javascript
// Run on startup
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
```

## Allowing Public Endpoints

By default, all endpoints require authentication. To make some public:

```yaml
# ingress.yaml annotations
nginx.ingress.kubernetes.io/configuration-snippet: |
  if ($request_uri ~* "^/(health|api/public)") {
    set $auth_request_access_token "";
    set $auth_request_user "";
  }
```

Or handle it in your app by checking if user header exists.

## Multi-User Apps

The user's email is passed in `X-Auth-Request-User` header. Use it to:
- Store user-specific data
- Show personalized content
- Implement authorization

Example:
```javascript
app.get('/api/my-data', async (req, res) => {
  const email = req.headers['x-auth-request-user'];
  const data = await db.query('SELECT * FROM data WHERE user_email = $1', [email]);
  res.json(data);
});
```

## Checklist

Before deploying, verify:

- [ ] `CLAUDE.md` is complete and accurate
- [ ] `/health` endpoint returns 200
- [ ] App respects `X-Auth-Request-User` header
- [ ] Dockerfile builds successfully
- [ ] K8s manifests have correct app name
- [ ] Resource limits are set appropriately
- [ ] Sensitive data is in secrets, not code
