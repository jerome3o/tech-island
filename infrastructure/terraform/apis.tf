# -----------------------------------------------------------------------------
# Enable Required GCP APIs
# These APIs must be enabled before other resources can be created
# -----------------------------------------------------------------------------

resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",           # Compute Engine
    "container.googleapis.com",         # GKE
    "artifactregistry.googleapis.com",  # Container Registry
    "sqladmin.googleapis.com",          # Cloud SQL
    "servicenetworking.googleapis.com", # Private Service Networking
    "cloudresourcemanager.googleapis.com", # Resource Manager
    "iam.googleapis.com",               # IAM
    "iamcredentials.googleapis.com",    # IAM Credentials (for Workload Identity)
    "logging.googleapis.com",           # Cloud Logging (for MCP server)
    "storage.googleapis.com",           # Cloud Storage (for avatar uploads)
  ])

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# Add dependencies to ensure APIs are enabled before resources are created
# This is a local value that other resources can depend on
locals {
  apis_enabled = [for api in google_project_service.required_apis : api.service]
}
