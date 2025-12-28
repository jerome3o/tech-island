# Tech Island Infrastructure - Terraform

This directory contains Terraform configuration for the GCP infrastructure.

## What Gets Created

- **GKE Cluster**: Regional Kubernetes cluster in europe-west2 (London)
- **VPC Network**: Private network with NAT for outbound traffic
- **Cloud SQL**: Managed PostgreSQL 15 instance (optional)
- **Artifact Registry**: Container image storage
- **Static IP**: For the ingress controller
- **Workload Identity**: Keyless authentication from GitHub Actions

## Prerequisites

1. A GCP project (see `docs/gcp-setup.md` for setup instructions)
2. A GCS bucket for Terraform state
3. `gcloud` CLI installed and authenticated
4. Terraform >= 1.5.0

## Usage

### First Time Setup

```bash
# Authenticate with GCP
gcloud auth application-default login

# Initialize Terraform with backend config
terraform init \
  -backend-config="bucket=YOUR-TERRAFORM-STATE-BUCKET" \
  -backend-config="prefix=terraform/state"

# Create a terraform.tfvars file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project ID

# Plan and apply
terraform plan
terraform apply
```

### After Initial Setup

```bash
# Get kubectl credentials
$(terraform output -raw get_credentials_command)

# View outputs
terraform output
```

## Files

| File | Purpose |
|------|---------|
| `versions.tf` | Provider versions and backend config |
| `variables.tf` | Input variables |
| `apis.tf` | Enables required GCP APIs |
| `networking.tf` | VPC, subnets, NAT, firewall |
| `gke.tf` | GKE cluster and node pool |
| `cloudsql.tf` | Cloud SQL PostgreSQL instance |
| `artifact-registry.tf` | Container registry + GitHub Actions SA |
| `outputs.tf` | Output values |

## Costs

Estimated monthly costs (as of 2024):
- GKE cluster (2x e2-medium): ~$50/month
- Cloud SQL (db-f1-micro): ~$10/month
- Networking (NAT, static IP): ~$5/month
- **Total**: ~$65/month

To reduce costs:
- Use `gke_num_nodes = 1` for dev/testing
- Use preemptible/spot VMs (add to node pool config)
- Disable Cloud SQL if not needed (`enable_cloud_sql = false`)

## Security Notes

- GKE nodes run in a private network with no public IPs
- Cloud SQL has no public IP, only accessible from VPC
- Workload Identity is enabled for secure pod authentication
- GitHub Actions uses OIDC (no long-lived credentials)
