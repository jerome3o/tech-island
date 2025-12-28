# -----------------------------------------------------------------------------
# Cluster Outputs
# -----------------------------------------------------------------------------

output "cluster_name" {
  description = "The name of the GKE cluster"
  value       = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  description = "The endpoint for the GKE cluster"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "cluster_location" {
  description = "The location of the GKE cluster"
  value       = google_container_cluster.primary.location
}

# Command to get credentials
output "get_credentials_command" {
  description = "Command to get kubectl credentials for the cluster"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region} --project ${var.project_id}"
}

# -----------------------------------------------------------------------------
# Networking Outputs
# -----------------------------------------------------------------------------

output "ingress_ip" {
  description = "Static IP address for the ingress controller"
  value       = var.create_static_ip ? google_compute_global_address.ingress_ip[0].address : null
}

output "ingress_ip_name" {
  description = "Name of the static IP resource"
  value       = var.create_static_ip ? google_compute_global_address.ingress_ip[0].name : null
}

# -----------------------------------------------------------------------------
# Database Outputs
# -----------------------------------------------------------------------------

output "database_instance_name" {
  description = "The name of the Cloud SQL instance"
  value       = var.enable_cloud_sql ? google_sql_database_instance.postgres[0].name : null
}

output "database_connection_name" {
  description = "The connection name for Cloud SQL (used by Cloud SQL Proxy)"
  value       = var.enable_cloud_sql ? google_sql_database_instance.postgres[0].connection_name : null
}

output "database_private_ip" {
  description = "The private IP address of the database"
  value       = var.enable_cloud_sql ? google_sql_database_instance.postgres[0].private_ip_address : null
  sensitive   = true
}

output "database_name" {
  description = "The name of the default database"
  value       = var.enable_cloud_sql ? google_sql_database.default[0].name : null
}

output "database_user" {
  description = "The database user"
  value       = var.enable_cloud_sql ? google_sql_user.app_user[0].name : null
}

output "database_password" {
  description = "The database password (store securely!)"
  value       = var.enable_cloud_sql ? random_password.db_password[0].result : null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Container Registry Outputs
# -----------------------------------------------------------------------------

output "artifact_registry_url" {
  description = "URL for the Artifact Registry repository"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}

# -----------------------------------------------------------------------------
# GitHub Actions Outputs
# -----------------------------------------------------------------------------

output "github_actions_service_account" {
  description = "Service account email for GitHub Actions"
  value       = google_service_account.github_actions.email
}

output "workload_identity_provider" {
  description = "Workload Identity Provider for GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github.name
}

# Formatted for use in GitHub Actions
output "github_actions_workload_identity_provider" {
  description = "Full provider path for GitHub Actions workflow"
  value       = "projects/${var.project_id}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.github.workload_identity_pool_provider_id}"
}
