# Tech Island

> A platform for rapidly building and deploying web applications with authentication, databases, and more.

## What Is This?

Tech Island is an infrastructure-as-code platform that allows you to:
1. Build a web application
2. Push to Git
3. Have it automatically deployed with Google authentication, TLS, and a public URL

**Your job as an agent**: When asked to build an application, create it in `apps/YOUR_APP_NAME/` following the patterns in this repo. Once you commit and push to `main`, GitHub Actions will deploy it automatically.

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

# 2. Rename all 'app-template' references to 'my-app'
# In: k8s/*.yaml, package.json, Dockerfile

# 3. Implement your app in src/

# 4. Update apps/my-app/CLAUDE.md with app description

# 5. Commit and push
git add apps/my-app
git commit -m "Add my-app: description"
git push origin main
```

### Detailed Version

See: `docs/creating-an-app.md`

## Authentication

**All apps are protected by Google authentication by default.**

The authenticated user's email is passed to your app via HTTP header:
- `X-Auth-Request-User`: User's email address

Example in Node.js:
```javascript
app.get('/api/whoami', (req, res) => {
  const email = req.headers['x-auth-request-user'];
  res.json({ email });
});
```

To allow public endpoints (no auth required), see `docs/creating-an-app.md#allowing-public-endpoints`.

## Database

Apps can use the shared PostgreSQL database. Connection string is provided via `DATABASE_URL` environment variable.

To request a database for your app:
1. Create a secret with the database credentials
2. Reference it in your deployment.yaml

## App Requirements

Every app MUST have:

1. **`CLAUDE.md`** - Documentation for future agents
2. **`Dockerfile`** - How to build the container
3. **`/health` endpoint** - Returns 200 OK (used for health checks)
4. **`k8s/` directory** - Kubernetes manifests (deployment, service, ingress)

## Key Files to Know

| Path | Purpose |
|------|---------|
| `apps/_template/` | Starting point for new apps |
| `apps/_template/CLAUDE.md` | Template for app documentation |
| `apps/_template/k8s/` | Kubernetes manifest templates |
| `docs/gcp-setup.md` | GCP project setup guide |
| `docs/creating-an-app.md` | Detailed app creation guide |

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
                              App live at: app-name.INGRESS_IP.nip.io
```

## Important Commands

```bash
# See all apps
ls apps/

# Check app status (requires kubectl access)
kubectl get pods -n apps
kubectl get ingress -n apps

# View app logs
kubectl logs -n apps -l app=APP_NAME

# Check workflow status
# Go to: GitHub → Actions tab
```

## Tech Stack

- **Cloud**: Google Cloud Platform
- **Orchestration**: Kubernetes (GKE)
- **Infrastructure**: Terraform
- **CI/CD**: GitHub Actions
- **Auth**: OAuth2-Proxy with Google
- **TLS**: cert-manager with Let's Encrypt
- **Ingress**: ingress-nginx
- **Database**: Cloud SQL PostgreSQL

## Common Tasks

### "Build me an app that does X"

1. Create `apps/app-name/` by copying template
2. Implement the app (Node.js, Python, Go - whatever fits)
3. Write the `CLAUDE.md` documenting what you built
4. Commit with a clear message: `Add app-name: brief description`
5. Push to `main`

### "Add a feature to existing app"

1. Read the app's `CLAUDE.md` to understand it
2. Make your changes
3. Update `CLAUDE.md` if needed
4. Commit and push

### "Fix a bug in app"

1. Read the app's `CLAUDE.md`
2. Check the app's code in `apps/app-name/src/`
3. Check logs if needed (mention you need kubectl access)
4. Fix and push

### "Change infrastructure"

1. Modify files in `infrastructure/terraform/`
2. Commit and push
3. The infrastructure workflow will plan/apply

## Secrets (Do Not Commit!)

Never commit:
- `.env` files
- OAuth credentials
- API keys
- Database passwords

These should be in GitHub Secrets or Kubernetes Secrets.

## Getting Help

- **GCP Setup**: `docs/gcp-setup.md`
- **Creating Apps**: `docs/creating-an-app.md`
- **Platform Components**: Check `platform/*/README.md`
- **Terraform**: `infrastructure/terraform/README.md`

## For Humans

If you're a human (hi Jerome!), here's what you need to know:

1. **First-time setup**: Follow `docs/gcp-setup.md` to configure GCP and GitHub secrets
2. **Costs**: Expect ~$65-80/month for the base infrastructure
3. **To deploy**: Just ask a Claude agent to build you an app!
4. **To access apps**: After deployment, apps are at `https://APP.INGRESS_IP.nip.io`

---

*Last updated: Created for tech-island platform*
