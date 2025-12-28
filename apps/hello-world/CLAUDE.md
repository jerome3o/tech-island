# App: hello-world

> A simple example app demonstrating the tech-island platform.

## Overview

This is a minimal example app that shows:
- How authentication works (displays logged-in user)
- How to structure a Node.js app
- How the k8s manifests should look

Use this as a reference when building new apps.

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: None (stateless)

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| GET | / | Yes | Welcome page with user info |
| GET | /api/me | Yes | Returns current user as JSON |
| GET | /api/time | Yes | Returns current server time |

## Local Development

```bash
cd apps/hello-world
npm install
npm run dev
# Visit http://localhost:3000
```

## What Users See

After logging in with Google, users see:
- A welcome message with their email
- Current server time
- Links to API endpoints

## Code Notes

- User email comes from `X-Auth-Request-User` header (set by oauth2-proxy)
- The `/health` endpoint is used by Kubernetes for liveness/readiness probes
- All other endpoints require authentication (enforced by ingress)
