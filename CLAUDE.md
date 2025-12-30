# Tech Island

> A platform for rapidly building and deploying web applications with authentication, TLS, and public URLs.

## What Is This?

Tech Island is an infrastructure-as-code platform that allows you to:
1. Build a web application
2. Push to Git
3. Have it automatically deployed with Google authentication, TLS, and a public URL

**Your job as an agent**: When asked to build an application, create it in `apps/YOUR_APP_NAME/` following the patterns in this repo. Once you commit and push to `main`, GitHub Actions will deploy it automatically.

**Important for agents**: If you make changes on a feature branch during a session, always provide the user with a pull request link so they can review and merge via GitHub's web UI. The link format is:
```
https://github.com/jerome3o/tech-island/compare/main...BRANCH_NAME
```
This allows users to create PRs from their phone/tablet without needing git CLI access.

## Current Infrastructure

- **Ingress IP**: `34.142.82.161`
- **App URLs**: `https://APP_NAME.34.142.82.161.nip.io`
- **Namespace**: Apps deploy to the `apps` namespace
- **User Database**: Shared PostgreSQL via `user-service` (see below)

## Repository Structure

```
tech-island/
├── CLAUDE.md                 # You are here!
├── infrastructure/terraform/ # GCP/GKE infrastructure (don't modify unless asked)
├── platform/                 # Ingress, auth, certs (don't modify unless asked)
├── apps/                     # YOUR APPS GO HERE
│   ├── _template/           # Copy this for new apps
│   └── [app-name]/          # Each app is a directory
├── .github/workflows/       # CI/CD pipelines
└── docs/                    # Setup guides and documentation
```

## How to Create a New App

### Quick Version

```bash
# 1. Copy the template
cp -r apps/_template apps/my-app

# 2. Rename all 'app-template' references to 'my-app' in these files:
#    - k8s/*.yaml (all yaml files)
#    - package.json
#    - Dockerfile (if app name is referenced)

# 3. Implement your app in src/

# 4. Update apps/my-app/CLAUDE.md with app description

# 5. Ensure package-lock.json exists (required for npm ci)
npm install --package-lock-only

# 6. Commit and push
git add apps/my-app
git commit -m "Add my-app: description"
git push origin main
```

### What Files Are Required

Every app in `apps/APP_NAME/` MUST have:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Documentation for future agents |
| `Dockerfile` | How to build the container |
| `package.json` + `package-lock.json` | Dependencies (for Node.js apps) |
| `src/` | Application source code |
| `k8s/deployment.yaml` | Kubernetes deployment |
| `k8s/service.yaml` | Kubernetes service |
| `k8s/ingress.yaml` | Main ingress with auth |
| `k8s/ingress-oauth2.yaml` | OAuth2 path ingress (prevents redirect loops) |
| `k8s/oauth2-proxy-service.yaml` | ExternalName service for oauth2-proxy |

**Important**: The `/health` endpoint must return 200 OK (used for health checks and is excluded from auth).

### Detailed Version

See: `docs/creating-an-app.md`

## Authentication

**All apps are protected by Google authentication by default.**

The authenticated user's email is passed to your app via HTTP headers:
- `X-Auth-Request-User`: User's email address
- `X-Auth-Request-Email`: User's email (same as above)

Example in Node.js:
```javascript
app.get('/api/whoami', (req, res) => {
  const email = req.headers['x-auth-request-user'];
  res.json({ email });
});
```

**Public endpoints**: The `/health` endpoint is automatically excluded from auth via oauth2-proxy configuration. Other public endpoints are not currently supported without platform changes.

## Shared User Database

**All apps share a centralized user database via the `user-service`.**

### Quick Start

```javascript
// Get current user (auto-creates if new)
const response = await fetch('http://user-service.apps.svc.cluster.local/api/users/me', {
  headers: { 'x-auth-request-user': req.headers['x-auth-request-user'] }
});
const user = await response.json();

// Update user profile
await fetch('http://user-service.apps.svc.cluster.local/api/users/me', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-request-user': req.headers['x-auth-request-user']
  },
  body: JSON.stringify({
    display_name: 'John Doe',
    metadata: { theme: 'dark', notifications: true }
  })
});
```

### Available Endpoints

- `GET /api/users/me` - Get current user (auto-creates if doesn't exist)
- `PUT /api/users/me` - Update current user profile

**Why use this?**
- Centralized user data across all apps
- No need to maintain separate user tables
- Flexible metadata field for app-specific data
- Automatic migrations

### Documentation

- **Full docs**: `apps/user-service/CLAUDE.md`
- **Client libraries**: `apps/user-service/docs/CLIENT.md` (Node.js & Python examples)
- **Live dashboard**: `https://user-service.34.142.82.161.nip.io`
- **Internal URL**: `http://user-service.apps.svc.cluster.local` (for app-to-app calls)

**Note**: The user-service follows a privacy-first design - users can only access their own data. No user listing or enumeration endpoints exist.

## Deployment Flow

```
You create app → Push to main → GitHub Actions triggered
                                      ↓
                              Build Docker image
                                      ↓
                              Push to Artifact Registry
                                      ↓
                              kubectl apply manifests
                                      ↓
                              cert-manager provisions TLS
                                      ↓
                              App live at: https://app-name.34.142.82.161.nip.io
```

## Common Tasks

### "Build me an app that does X"

1. Copy `apps/_template/` to `apps/app-name/`
2. Rename all `app-template` references to `app-name`
3. Implement the app (Node.js, Python, Go - whatever fits)
4. Write the `CLAUDE.md` documenting what you built
5. Ensure `package-lock.json` exists (run `npm install --package-lock-only`)
6. Commit with a clear message: `Add app-name: brief description`
7. Push to `main`

### "Add a feature to existing app"

1. Read the app's `CLAUDE.md` to understand it
2. Make your changes
3. Update `CLAUDE.md` if needed
4. Commit and push

### "Fix a bug in app"

1. Read the app's `CLAUDE.md`
2. Check the app's code in `apps/app-name/src/`
3. If you need logs, ask the user to check GitHub Actions or provide kubectl access
4. Fix and push

## Debugging Guide

When something goes wrong, here's how to investigate:

### Deployment Failed

1. Check GitHub Actions logs at: GitHub repo → Actions tab
2. Common issues:
   - **npm ci failed**: Missing `package-lock.json` - run `npm install --package-lock-only`
   - **Docker build failed**: Check Dockerfile syntax and dependencies
   - **kubectl apply failed**: Check YAML syntax in k8s/ files

### App Not Loading

1. **Redirect loop on /oauth2/start**: Missing `ingress-oauth2.yaml` - the /oauth2 paths need a separate ingress without auth annotations
2. **TLS certificate errors**: Wait 1-2 minutes for cert-manager to provision; check if `LETSENCRYPT_EMAIL` secret is set
3. **502 Bad Gateway**: Pod might be crashing - check deployment health

### Auth Not Working

1. Verify Google OAuth redirect URI is set correctly in GCP Console:
   ```
   https://APP_NAME.34.142.82.161.nip.io/oauth2/callback
   ```
2. Check that both ingress files exist (`ingress.yaml` and `ingress-oauth2.yaml`)

### Questions to Ask the User

If you can't diagnose an issue, ask the user:
- "Can you check the GitHub Actions logs for the latest deployment?"
- "Can you verify the OAuth redirect URI in Google Cloud Console includes `https://APP_NAME.34.142.82.161.nip.io/oauth2/callback`?"
- "Is there a specific error message in the browser?"

## Tech Stack

- **Cloud**: Google Cloud Platform
- **Orchestration**: Kubernetes (GKE)
- **Infrastructure**: Terraform
- **CI/CD**: GitHub Actions (Workload Identity Federation)
- **Auth**: OAuth2-Proxy with Google
- **TLS**: cert-manager with Let's Encrypt (auto-provisioned)
- **Ingress**: ingress-nginx

## Key Files Reference

| Path | Purpose |
|------|---------|
| `apps/_template/` | Starting point for new apps - copy this |
| `apps/_template/CLAUDE.md` | Template for app documentation |
| `apps/_template/k8s/` | All required Kubernetes manifests |
| `.github/workflows/deploy-app.yml` | App deployment workflow |
| `platform/oauth2-proxy/` | OAuth2 proxy configuration |

## Secrets (Do Not Commit!)

Never commit:
- `.env` files
- OAuth credentials
- API keys
- Database passwords

These are managed in GitHub Secrets and Kubernetes Secrets.

## Important Notes

1. **Always include `package-lock.json`** - The build uses `npm ci` which requires it
2. **Don't use `configuration-snippet` annotations** - They're disabled in ingress-nginx for security
3. **TLS is automatic** - cert-manager provisions Let's Encrypt certificates automatically
4. **Each app needs two ingresses** - One for the app (with auth) and one for /oauth2 paths (without auth)
5. **Follow security guidelines** - See `SECURITY.md` for privacy and security requirements
