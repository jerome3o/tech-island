# App: [APP_NAME]

> This file provides context for Claude Code agents working on this app.

## Overview

[Brief description of what this app does]

## Tech Stack

- **Runtime**: Node.js 20 / Python 3.11 / Go 1.21 (choose one)
- **Framework**: Express / FastAPI / Gin (choose one)
- **Database**: PostgreSQL (shared Cloud SQL instance)
- **Auth**: Handled by platform (oauth2-proxy) - user email available in headers

## Quick Start

```bash
# Local development
cd apps/[APP_NAME]
npm install  # or pip install -r requirements.txt
npm run dev  # or python main.py

# Build container
docker build -t [APP_NAME] .

# Run container locally
docker run -p 3000:3000 [APP_NAME]
```

## Authentication

Auth is handled at the ingress level. Your app receives these headers:

- `X-Auth-Request-User`: User's email
- `X-Auth-Request-Groups`: User's groups (if configured)
- `X-Auth-Request-Preferred-Username`: Username

**Do not implement your own auth** - rely on these headers.

To get the current user in your app:

```javascript
// Express.js
app.get('/api/me', (req, res) => {
  const email = req.headers['x-auth-request-user'];
  res.json({ email });
});
```

```python
# FastAPI
@app.get("/api/me")
def get_me(x_auth_request_user: str = Header()):
    return {"email": x_auth_request_user}
```

## Database

Connection string is provided via environment variable:

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

Each app gets its own database. Request a new database by adding to `apps/[APP_NAME]/k8s/database.yaml`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check (no auth) |
| GET | /api/... | Your endpoints |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| DATABASE_URL | PostgreSQL connection | (required) |
| NODE_ENV | Environment | production |

## Deployment

This app is automatically deployed when changes are pushed to `main`.

To deploy manually:
1. Make changes to files in this directory
2. Commit and push to main
3. GitHub Actions will build and deploy

View deployment status: [GitHub Actions](../../.github/workflows/deploy-app.yml)

## File Structure

```
apps/[APP_NAME]/
├── CLAUDE.md           # This file
├── Dockerfile          # Container build
├── package.json        # Dependencies (Node.js)
├── src/                # Application code
│   ├── index.js        # Entry point
│   └── ...
└── k8s/                # Kubernetes manifests
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml
```

## Known Issues

[List any known issues or limitations]

## Related Apps

[List any related apps in this repo]
