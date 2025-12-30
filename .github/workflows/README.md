# GitHub Actions Workflows

## Setup Database Secret (One-Time)

The `setup-database-secret.yml` workflow creates the Kubernetes secret for database credentials.

### When to Run

Run this workflow **once** before deploying user-service for the first time.

### How to Run (From Your Phone!)

1. **Open GitHub on your phone**
2. Navigate to: **Actions** tab
3. Click: **Setup Database Secret**
4. Click: **Run workflow** button
5. In the confirmation box, type: `create-secret`
6. Click: **Run workflow** (green button)

### What It Does

1. ✅ Authenticates to GCP
2. ✅ Connects to your GKE cluster
3. ✅ Reads Terraform state to get database credentials
4. ✅ Creates `cloudsql-db-credentials` secret in the `apps` namespace
5. ✅ All secrets are masked in logs (nothing sensitive exposed)

### Prerequisites

**IMPORTANT**: All required secrets should already exist! This workflow uses the same secrets as the infrastructure deployment.

The following GitHub secrets are required (should already be configured):

| Secret | Description | Also Used By |
|--------|-------------|--------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider for GCP | All GCP workflows |
| `GCP_SERVICE_ACCOUNT` | Service account email for GitHub Actions | All GCP workflows |
| `GKE_CLUSTER_NAME` | Name of your GKE cluster | deploy-app.yml |
| `GKE_CLUSTER_LOCATION` | Region where your GKE cluster is | deploy-app.yml |
| `GCP_PROJECT_ID` | Your GCP project ID | infrastructure.yml |
| `TF_STATE_BUCKET` | GCS bucket name where Terraform state is stored | **infrastructure.yml** |

**Note for agents**: Do NOT create a new `TERRAFORM_STATE_BUCKET` secret. The existing `TF_STATE_BUCKET` secret (used by `infrastructure.yml`) contains the GCS bucket where Terraform stores its state. This workflow reads from that state to get database credentials.

### Checking If It Worked

After the workflow completes:
1. Check the workflow run - should be all green ✅
2. The last step shows: "🎉 Database secret setup complete!"

### If It Fails

Common issues:

**"Failed to get database credentials"**
- Cloud SQL might not be enabled in Terraform
- Terraform state might not be accessible
- Check that `TF_STATE_BUCKET` secret is correct

**"Secret verification failed"**
- Permissions issue with GKE
- Check that the service account has Kubernetes Admin role

**Other errors**
- Check the workflow logs
- Verify all GitHub secrets are set correctly

### After Success

Once the secret is created:
1. Merge your feature branch to `main`
2. `user-service` will deploy automatically via the regular deploy workflow
3. Service will be available at: `https://user-service.34.142.82.161.nip.io`

---

## Deploy App (Automatic)

The `deploy-app.yml` workflow automatically deploys apps when you push to `main`.

See: `docs/creating-an-app.md` for details.
