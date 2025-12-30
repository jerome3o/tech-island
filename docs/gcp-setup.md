# GCP Setup Guide

This guide walks you through setting up the GCP project and configuring everything needed to run tech-island.

## Prerequisites

- A Google account
- A credit card (GCP offers $300 free credit for new accounts)
- `gcloud` CLI installed locally (optional, for testing)

## Step 1: Create a GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click "New Project"
4. Enter:
   - **Project name**: `tech-island` (or your preferred name)
   - **Organization**: Leave as-is or select your org
5. Click "Create"
6. **Note your Project ID** - you'll need this later (it's shown below the project name, like `tech-island-123456`)

## Step 2: Enable Required APIs

Before Terraform can run, you need to manually enable these APIs:

1. Go to [APIs & Services](https://console.cloud.google.com/apis/library)
2. Enable each of these:
   - Compute Engine API
   - Kubernetes Engine API
   - Cloud Resource Manager API
   - IAM Credentials API
   - Artifact Registry API
   - Cloud SQL Admin API (if using database)

> **Note**: This is a chicken-and-egg problem - Terraform can't enable APIs without permission, and can't get permission without APIs enabled.

## Step 3: Enable Billing

1. Go to [Billing](https://console.cloud.google.com/billing)
2. Link a billing account to your project
3. If you're new to GCP, you'll get $300 free credit

## Step 4: Create a Terraform State Bucket

Terraform needs a GCS bucket to store its state.

1. Go to [Cloud Storage](https://console.cloud.google.com/storage)
2. Click "Create Bucket"
3. Configure:
   - **Name**: `tech-island-tf-state-RANDOM` (must be globally unique, add random suffix)
   - **Location**: `europe-west2` (same as your cluster)
   - **Storage class**: Standard
   - **Access control**: Uniform
4. Click "Create"
5. **Note your bucket name** - you'll add this to GitHub secrets

## Step 5: Create OAuth Credentials

This enables Google login for your apps.

### 5.1: Configure OAuth Consent Screen

1. Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Select "External" (unless you have a Google Workspace org)
3. Click "Create"
4. Fill in:
   - **App name**: `Tech Island`
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click "Save and Continue"
6. **Scopes**: Click "Add or Remove Scopes"
   - Select: `email`, `profile`, `openid`
   - Click "Update"
7. Click "Save and Continue"
8. **Test users**: Add your email and any testers' emails
9. Click "Save and Continue"

### 5.2: Create OAuth Client

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth client ID"
3. Configure:
   - **Application type**: Web application
   - **Name**: `tech-island-oauth`
   - **Authorized redirect URIs**: (add after getting ingress IP)
4. Click "Create"
5. **Save the Client ID and Client Secret** - you'll need these for GitHub secrets

> **Important**: You'll update the redirect URIs after infrastructure is deployed and you have your ingress IP.

## Step 6: Generate Cookie Secret

The OAuth proxy needs a secret for encrypting cookies. **It must be exactly 32 bytes**:

```bash
# This generates exactly 32 bytes (24 * 4/3 = 32)
openssl rand -base64 24
```

Save this value - you'll add it to GitHub secrets.

> **Warning**: Using `openssl rand -base64 32` generates 44 characters, which is too long and will cause errors.

## Step 7: Create Bootstrap Service Account

For the initial Terraform run, you need a service account with appropriate permissions:

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "Create Service Account"
3. Name it `terraform-bootstrap`
4. Grant it the **Editor** role (or Owner for simplicity during bootstrap)
5. Click "Done"
6. Click on the service account → Keys → Add Key → Create new key → JSON
7. Save the JSON file securely

## Step 8: Configure GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these **Repository secrets**:

### Initial Bootstrap Secrets

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `GCP_PROJECT_ID` | `tech-island-123456` | Your GCP project ID |
| `GCP_SA_KEY` | (JSON key content) | Service account key for bootstrap |
| `TF_STATE_BUCKET` | `tech-island-tf-state-xxx` | Your state bucket name (used by infrastructure.yml and setup-database-secret.yml) |
| `GKE_CLUSTER_NAME` | `tech-island` | Cluster name |
| `GKE_CLUSTER_LOCATION` | `europe-west2` | Cluster region |
| `GCP_REGION` | `europe-west2` | GCP region |

### OAuth & Platform Secrets

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `OAUTH2_CLIENT_ID` | `xxx.apps.googleusercontent.com` | From OAuth credentials |
| `OAUTH2_CLIENT_SECRET` | `GOCSPX-xxx` | From OAuth credentials |
| `OAUTH2_COOKIE_SECRET` | (generated above) | Exactly 32 bytes! |
| `LETSENCRYPT_EMAIL` | `your@email.com` | For cert expiry notifications |

### After Terraform Completes (Workload Identity)

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | (from Terraform output) | Uses PROJECT_NUMBER not ID! |
| `GCP_SERVICE_ACCOUNT` | (from Terraform output) | GitHub Actions SA |
| `ARTIFACT_REGISTRY_URL` | (from Terraform output) | Container registry URL |

## Step 9: Bootstrap Terraform

### First Run (with Service Account Key)

1. Ensure workflow uses service account key auth:
   ```yaml
   - uses: google-github-actions/auth@v2
     with:
       credentials_json: ${{ secrets.GCP_SA_KEY }}
   ```
2. Trigger the Infrastructure workflow manually
3. Wait for completion (~10 min for Cloud SQL)
4. Note the outputs (workload identity provider, etc.)

### Switch to Workload Identity

After the first run succeeds:

1. Get the Workload Identity Provider from Terraform output
   - **Important**: It uses the PROJECT NUMBER, not PROJECT ID!
   - Format: `projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github-provider`
2. Add the `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` secrets
3. Add the `ARTIFACT_REGISTRY_URL` secret
4. Update workflow to use Workload Identity:
   ```yaml
   - uses: google-github-actions/auth@v2
     with:
       workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
       service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
   ```
5. Delete the `GCP_SA_KEY` secret (no longer needed)
6. Delete the bootstrap service account key from GCP

## Step 10: Deploy Platform Components

Trigger the Platform Components workflow:

1. Go to GitHub Actions
2. Run "Platform Components" workflow manually
3. Select "all" components
4. Wait for deployment

This deploys:
- ingress-nginx (traffic routing)
- cert-manager (TLS certificates)
- oauth2-proxy (Google authentication)

## Step 11: Update OAuth Redirect URIs

After platform is deployed:

1. Get the ingress IP from workflow output or run:
   ```bash
   kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
   ```
2. Go back to [OAuth Credentials](https://console.cloud.google.com/apis/credentials)
3. Edit your OAuth client
4. Add redirect URIs for each app:
   ```
   https://hello-world.INGRESS_IP.nip.io/oauth2/callback
   https://my-app.INGRESS_IP.nip.io/oauth2/callback
   ```

> **Note**: You need to add a redirect URI for EACH app you deploy.

## Step 12: Verify Everything Works

1. Deploy the hello-world app by pushing to main
2. Wait for GitHub Actions to complete
3. Visit: `https://hello-world.INGRESS_IP.nip.io`
4. You should be redirected to Google login
5. After login, you should see the app

## Troubleshooting

### "Invalid redirect URI"

- Make sure you added the EXACT redirect URI in OAuth credentials
- Format: `https://APP_NAME.INGRESS_IP.nip.io/oauth2/callback`
- Each app needs its own redirect URI

### "Redirect loop" on /oauth2/start

- The app is missing `ingress-oauth2.yaml`
- Each app needs a separate ingress for /oauth2 paths without auth annotations

### "Cookie secret must be 16, 24, or 32 bytes"

- Regenerate with: `openssl rand -base64 24`
- Update the `OAUTH2_COOKIE_SECRET` GitHub secret

### "403 Forbidden" or RBAC errors

- The GitHub Actions service account may need additional permissions
- Check it has `roles/container.admin` for GKE access

### Workload Identity "invalid_target" error

- Make sure you're using the PROJECT NUMBER (e.g., `123456789`), not PROJECT ID
- Check the full provider string matches Terraform output exactly

### Certificate not provisioning

- Check `LETSENCRYPT_EMAIL` secret is set
- Wait 1-2 minutes for cert-manager to request certificate
- Check cert-manager logs if still failing

## Cost Optimization

Expected monthly costs (~$65-80):
- GKE cluster (2x e2-medium): ~$50
- Cloud SQL (db-f1-micro): ~$10
- Networking: ~$5
- Storage: ~$5

To reduce costs:
- Use 1 node instead of 2: modify Terraform
- Disable Cloud SQL if not using databases
