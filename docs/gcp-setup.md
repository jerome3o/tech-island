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

## Step 2: Enable Billing

1. Go to [Billing](https://console.cloud.google.com/billing)
2. Link a billing account to your project
3. If you're new to GCP, you'll get $300 free credit

## Step 3: Create a Terraform State Bucket

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

## Step 4: Create OAuth Credentials

This enables Google login for your apps.

### 4.1: Configure OAuth Consent Screen

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

### 4.2: Create OAuth Client

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth client ID"
3. Configure:
   - **Application type**: Web application
   - **Name**: `tech-island-oauth`
   - **Authorized redirect URIs**: Add these (replace IP later):
     - `https://INGRESS_IP.nip.io/oauth2/callback`
     - `http://localhost:4180/oauth2/callback` (for testing)
4. Click "Create"
5. **Save the Client ID and Client Secret** - you'll need these for GitHub secrets

> **Note**: You'll update the redirect URIs after you get your ingress IP address.

## Step 5: Generate Cookie Secret

The OAuth proxy needs a secret for encrypting cookies:

```bash
openssl rand -base64 32
```

Save this value - you'll add it to GitHub secrets.

## Step 6: Configure GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these **Repository secrets**:

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `GCP_PROJECT_ID` | `tech-island-123456` | Your GCP project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | (see below) | From Terraform output |
| `GCP_SERVICE_ACCOUNT` | (see below) | From Terraform output |
| `TF_STATE_BUCKET` | `tech-island-tf-state-xxx` | Your state bucket name |
| `GKE_CLUSTER_NAME` | `tech-island` | Cluster name |
| `GKE_CLUSTER_LOCATION` | `europe-west2` | Cluster region |
| `GCP_REGION` | `europe-west2` | GCP region |
| `ARTIFACT_REGISTRY_URL` | (see below) | From Terraform output |
| `OAUTH2_CLIENT_ID` | `xxx.apps.googleusercontent.com` | From OAuth credentials |
| `OAUTH2_CLIENT_SECRET` | `GOCSPX-xxx` | From OAuth credentials |
| `OAUTH2_COOKIE_SECRET` | (generated above) | Random 32-byte string |
| `LETSENCRYPT_EMAIL` | `your@email.com` | For cert expiry notifications |

### Workload Identity Provider

This is created by Terraform. After first `terraform apply`, you'll get:

```
GCP_WORKLOAD_IDENTITY_PROVIDER = projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github-provider
GCP_SERVICE_ACCOUNT = tech-island-github-actions@PROJECT_ID.iam.gserviceaccount.com
ARTIFACT_REGISTRY_URL = europe-west2-docker.pkg.dev/PROJECT_ID/tech-island-containers
```

## Step 7: Bootstrap Terraform (First Time Only)

For the first Terraform run, you need to authenticate manually:

### Option A: Run from GitHub Actions (Recommended)

1. Add secrets from Step 6 (except workload identity ones)
2. Temporarily add a service account key:
   - Create a service account in GCP Console
   - Grant it "Owner" role (for bootstrapping only)
   - Create a JSON key
   - Add as `GCP_SA_KEY` secret in GitHub
3. Modify the workflow to use the key:
   ```yaml
   - uses: google-github-actions/auth@v2
     with:
       credentials_json: ${{ secrets.GCP_SA_KEY }}
   ```
4. Run the workflow
5. After success, update to use Workload Identity (from outputs)
6. Delete the service account key

### Option B: Run Locally

```bash
# Authenticate
gcloud auth application-default login

# Navigate to terraform directory
cd infrastructure/terraform

# Initialize
terraform init \
  -backend-config="bucket=YOUR_TF_STATE_BUCKET" \
  -backend-config="prefix=terraform/state"

# Create tfvars
cat > terraform.tfvars <<EOF
project_id = "YOUR_PROJECT_ID"
EOF

# Apply
terraform plan
terraform apply
```

## Step 8: Update OAuth Redirect URIs

After Terraform creates the infrastructure:

1. Get the ingress IP:
   ```bash
   terraform output ingress_ip
   ```
2. Go back to [OAuth Credentials](https://console.cloud.google.com/apis/credentials)
3. Edit your OAuth client
4. Update redirect URIs:
   - `https://INGRESS_IP.nip.io/oauth2/callback`
   - `https://APP_NAME.INGRESS_IP.nip.io/oauth2/callback`

## Step 9: Deploy Platform Components

Trigger the platform workflow:

1. Go to GitHub Actions
2. Run "Platform Components" workflow manually
3. Select "all" components
4. Wait for deployment

## Step 10: Verify Everything Works

1. Get the ingress IP from workflow output or:
   ```bash
   kubectl get svc -n ingress-nginx ingress-nginx-controller
   ```

2. Access the test URL:
   ```
   https://YOUR_IP.nip.io/oauth2/sign_in
   ```

3. You should see the Google login page

## Troubleshooting

### "Invalid redirect URI"

- Make sure you added the correct redirect URI in OAuth credentials
- Format: `https://ANYTHING.INGRESS_IP.nip.io/oauth2/callback`

### "403 Forbidden" from Kubernetes

- Check the GitHub Actions service account has the right roles
- Check Workload Identity is configured correctly

### "Connection refused"

- Wait a few minutes for the LoadBalancer IP to provision
- Check ingress-nginx pods are running: `kubectl get pods -n ingress-nginx`

### Certificate errors

- For nip.io domains, you'll get cert warnings (expected)
- For real domains, check cert-manager logs: `kubectl logs -n cert-manager -l app=cert-manager`

## Cost Optimization

Expected monthly costs (~$65-80):
- GKE cluster (2x e2-medium): ~$50
- Cloud SQL (db-f1-micro): ~$10
- Networking: ~$5
- Storage: ~$5

To reduce costs:
- Use 1 node instead of 2: set `gke_num_nodes = 1`
- Use preemptible VMs (not recommended for production)
- Turn off Cloud SQL if not using it: `enable_cloud_sql = false`
