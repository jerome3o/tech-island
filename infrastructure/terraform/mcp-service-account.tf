# -----------------------------------------------------------------------------
# MCP Server Service Account
# -----------------------------------------------------------------------------
# This service account is used by the Cloudflare Worker MCP server to access
# GKE clusters and Cloud Logging. The JSON key should be manually created and
# stored in GitHub Secrets as GCP_MCP_SERVICE_ACCOUNT_KEY.

resource "google_service_account" "mcp_server" {
  account_id   = "mcp-server"
  project      = var.project_id
  display_name = "MCP Server Service Account"
  description  = "Service account for remote MCP server to access GKE and Cloud Logging"
}

# -----------------------------------------------------------------------------
# IAM Roles for MCP Server
# -----------------------------------------------------------------------------

# Container Developer - for GKE cluster access (kubectl-like operations)
resource "google_project_iam_member" "mcp_container_developer" {
  project = var.project_id
  role    = "roles/container.developer"
  member  = "serviceAccount:${google_service_account.mcp_server.email}"
}

# Logging Viewer - for Cloud Logging access
resource "google_project_iam_member" "mcp_logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.mcp_server.email}"
}

# Monitoring Viewer - for Cloud Monitoring/metrics access
resource "google_project_iam_member" "mcp_monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.mcp_server.email}"
}

# Kubernetes Engine Viewer - for listing clusters
resource "google_project_iam_member" "mcp_gke_viewer" {
  project = var.project_id
  role    = "roles/container.viewer"
  member  = "serviceAccount:${google_service_account.mcp_server.email}"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "mcp_service_account_email" {
  description = "Email of the MCP server service account"
  value       = google_service_account.mcp_server.email
}

output "mcp_service_account_setup_instructions" {
  description = "Instructions for creating the service account key"
  value = <<-EOT

  To set up the MCP server service account key:

  1. Go to GCP Console: https://console.cloud.google.com/iam-admin/serviceaccounts?project=${var.project_id}

  2. Find the service account: ${google_service_account.mcp_server.email}

  3. Click "Keys" → "Add Key" → "Create new key" → "JSON"

  4. Download the JSON key file

  5. Add to GitHub Secrets:
     - Name: GCP_MCP_SERVICE_ACCOUNT_KEY
     - Value: Paste the entire contents of the JSON file

  6. The deployment workflow will automatically set this in Cloudflare Worker secrets

  EOT
}
