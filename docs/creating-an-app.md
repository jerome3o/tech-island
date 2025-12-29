# Creating a New App

This guide is for Claude Code agents (or humans!) creating new applications.

## Quick Start

1. Copy the template:
   ```bash
   cp -r apps/_template apps/my-new-app
   ```

2. Rename all references from `app-template` to `my-new-app`:
   - `k8s/*.yaml` (all YAML files)
   - `package.json`
   - Update hostnames in ingress files

3. Implement your app in `src/`

4. Update `CLAUDE.md` with app description

5. Generate package-lock.json (required):
   ```bash
   cd apps/my-new-app
   npm install --package-lock-only
   ```

6. Add OAuth redirect URI in Google Cloud Console:
   ```
   https://my-new-app.34.142.82.161.nip.io/oauth2/callback
   ```

7. Commit and push to main:
   ```bash
   git add apps/my-new-app
   git commit -m "Add my-new-app: brief description"
   git push origin main
   ```

GitHub Actions will automatically build and deploy.

## Required Files

Every app MUST have these files:

```
apps/my-app/
├── CLAUDE.md                    # App documentation for agents
├── Dockerfile                   # Container build instructions
├── package.json                 # Dependencies
├── package-lock.json            # Locked dependencies (required for npm ci)
├── src/
│   └── index.js                 # Application code
└── k8s/
    ├── deployment.yaml          # Kubernetes deployment
    ├── service.yaml             # Kubernetes service
    ├── ingress.yaml             # Main ingress (with auth)
    ├── ingress-oauth2.yaml      # OAuth2 paths (without auth)
    └── oauth2-proxy-service.yaml # ExternalName to oauth2-proxy
```

## Detailed Guide

### Step 1: Create App Directory

```bash
cp -r apps/_template apps/my-app
```

### Step 2: Write the CLAUDE.md

Every app MUST have a `CLAUDE.md` file. This provides context for any agent that works on the app later.

Include:
- What the app does
- Tech stack
- How to run locally
- API endpoints
- Known issues

### Step 3: Implement the App

Choose your tech stack:

**Node.js (recommended for quick apps)**
```javascript
// src/index.js
const express = require('express');
const app = express();

// Health check - required, excluded from auth
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Protected endpoints - user email is in headers
app.get('/api/hello', (req, res) => {
  const user = req.headers['x-auth-request-user'];
  res.json({ message: `Hello ${user}!` });
});

app.listen(3000, () => console.log('Server running on port 3000'));
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

> **Important**: Use `npm ci` (not `npm install`). This requires `package-lock.json` to exist.

### Step 5: Create Kubernetes Manifests

You need FIVE files in `k8s/`:

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
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
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

**ingress.yaml** - Main ingress WITH auth
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  labels:
    app: my-app
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.oauth2-proxy.svc.cluster.local:4180/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://$host/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Email,X-Auth-Request-Preferred-Username,X-Auth-Request-Groups"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - my-app.34.142.82.161.nip.io
      secretName: my-app-tls
  rules:
    - host: my-app.34.142.82.161.nip.io
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

**ingress-oauth2.yaml** - OAuth2 paths WITHOUT auth (prevents redirect loop)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-oauth2
  labels:
    app: my-app
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - my-app.34.142.82.161.nip.io
      secretName: my-app-tls
  rules:
    - host: my-app.34.142.82.161.nip.io
      http:
        paths:
          - path: /oauth2
            pathType: Prefix
            backend:
              service:
                name: oauth2-proxy
                port:
                  number: 4180
```

**oauth2-proxy-service.yaml** - ExternalName to access oauth2-proxy
```yaml
apiVersion: v1
kind: Service
metadata:
  name: oauth2-proxy
  labels:
    app: my-app
spec:
  type: ExternalName
  externalName: oauth2-proxy.oauth2-proxy.svc.cluster.local
  ports:
    - port: 4180
```

> **Why two ingresses?** The main ingress has auth annotations that would create a redirect loop on `/oauth2/*` paths. The separate ingress routes OAuth paths directly to oauth2-proxy without auth.

### Step 6: Generate package-lock.json

**This is required** - the Docker build uses `npm ci` which needs it:

```bash
cd apps/my-app
npm install --package-lock-only
```

### Step 7: Add OAuth Redirect URI

In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client:

Add:
```
https://my-app.34.142.82.161.nip.io/oauth2/callback
```

### Step 8: Deploy

```bash
git add apps/my-app
git commit -m "Add my-app: brief description"
git push origin main
```

Watch the deployment in GitHub Actions.

## Common Issues

### npm ci fails
- Missing `package-lock.json`
- Run: `npm install --package-lock-only`

### Redirect loop on /oauth2/start
- Missing `ingress-oauth2.yaml`
- Or missing `oauth2-proxy-service.yaml`

### "Invalid redirect URI"
- Add the callback URL in Google Cloud Console
- Format: `https://APP_NAME.34.142.82.161.nip.io/oauth2/callback`

### TLS certificate errors
- Wait 1-2 minutes for cert-manager
- Check `LETSENCRYPT_EMAIL` secret is configured

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
- [ ] `package-lock.json` exists
- [ ] All 5 k8s files exist with correct app name
- [ ] Hostnames updated in both ingress files
- [ ] OAuth redirect URI added in GCP Console
- [ ] Dockerfile builds successfully
