# Tech Island

**Deploy web apps by talking to Claude.**

Tech Island is a platform that lets you spin up a Claude Code remote worker, describe what you want, and have a fully deployed web application with authentication - in minutes.

## The Vision

```
You: "Build me a todo app"
Claude: *builds it, pushes to git*
GitHub Actions: *deploys to Kubernetes*
You: Visit https://todo-app.34.142.82.161.nip.io
     → Google login → Your app is live
```

No manual deployment. No config files to write. Just describe what you want.

## How It Works

1. **You start a Claude Code session** (locally or via remote worker)
2. **Describe your app**: "I want a simple notes app where I can save markdown notes"
3. **Claude builds it**: Creates the app, writes tests, commits to git
4. **GitHub Actions deploys**: Builds container, pushes to registry, deploys to Kubernetes
5. **Your app is live**: Accessible at `https://your-app.34.142.82.161.nip.io` with Google auth

Every app automatically gets:
- HTTPS with Let's Encrypt certificates
- Google authentication (your Google account)
- A public URL
- Health checks and auto-restart

## What's Inside

```
tech-island/
├── apps/                    # Your applications live here
│   ├── _template/          # Starter template for new apps
│   └── hello-world/        # Example app
├── infrastructure/         # Terraform for GCP/GKE
├── platform/               # Kubernetes platform components
└── .github/workflows/      # CI/CD automation
```

## For App Developers (Agents)

See [CLAUDE.md](./CLAUDE.md) for instructions on building apps. The key points:

1. Copy `apps/_template` to create a new app
2. Implement your app with a `/health` endpoint
3. Push to main - it deploys automatically
4. Apps are accessible at `https://APP_NAME.34.142.82.161.nip.io`

## For Platform Setup (Humans)

If you're setting this up from scratch, see [docs/gcp-setup.md](./docs/gcp-setup.md).

**Prerequisites:**
- Google Cloud Platform account
- GitHub repository
- ~$65-80/month for infrastructure

**What gets deployed:**
- GKE Kubernetes cluster
- ingress-nginx for traffic routing
- cert-manager for automatic TLS
- oauth2-proxy for Google authentication
- Artifact Registry for container images

## Current Status

**Ingress IP:** `34.142.82.161`
**App URLs:** `https://APP_NAME.34.142.82.161.nip.io`

## Tech Stack

| Component | Technology |
|-----------|------------|
| Cloud | Google Cloud Platform |
| Orchestration | Kubernetes (GKE) |
| Infrastructure | Terraform |
| CI/CD | GitHub Actions |
| Auth | OAuth2-Proxy + Google |
| TLS | cert-manager + Let's Encrypt |
| Ingress | ingress-nginx |

## Cost

Approximate monthly costs:
- GKE cluster (2x e2-medium): ~$50
- Cloud SQL (optional): ~$10
- Networking & storage: ~$10

**Total: ~$65-80/month**

## Why "Tech Island"?

It's a self-contained island of infrastructure where you can rapidly prototype and deploy ideas. Land on the island, build something, ship it.

---

*Built for rapid prototyping with AI assistance.*
