# -----------------------------------------------------------------------------
# Cloud SQL PostgreSQL Instance
# -----------------------------------------------------------------------------

resource "random_id" "db_name_suffix" {
  count       = var.enable_cloud_sql ? 1 : 0
  byte_length = 4
}

resource "google_sql_database_instance" "postgres" {
  count            = var.enable_cloud_sql ? 1 : 0
  name             = "${var.cluster_name}-postgres-${random_id.db_name_suffix[0].hex}"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier      = var.db_tier
    disk_size = var.db_disk_size
    disk_type = "PD_SSD"

    # Availability - single zone for cost savings (change for production)
    availability_type = "ZONAL"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00" # 3 AM
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled    = false # No public IP
      private_network = google_compute_network.vpc.id
    }

    maintenance_window {
      day  = 7 # Sunday
      hour = 3 # 3 AM
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
  }

  deletion_protection = false # Disabled for teardown

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# -----------------------------------------------------------------------------
# Private Service Connection (for Cloud SQL private IP)
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "private_ip_range" {
  count         = var.enable_cloud_sql ? 1 : 0
  name          = "${var.cluster_name}-private-ip-range"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  count                   = var.enable_cloud_sql ? 1 : 0
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range[0].name]
}

# -----------------------------------------------------------------------------
# Default Database
# -----------------------------------------------------------------------------

resource "google_sql_database" "default" {
  count    = var.enable_cloud_sql ? 1 : 0
  name     = "techisland"
  project  = var.project_id
  instance = google_sql_database_instance.postgres[0].name
}

# -----------------------------------------------------------------------------
# Database User
# Passwords are managed via Kubernetes secrets, not Terraform
# This creates a user that apps will use
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  count   = var.enable_cloud_sql ? 1 : 0
  length  = 32
  special = false # Avoid special chars for easier connection string handling
}

resource "google_sql_user" "app_user" {
  count    = var.enable_cloud_sql ? 1 : 0
  name     = "techisland"
  project  = var.project_id
  instance = google_sql_database_instance.postgres[0].name
  password = random_password.db_password[0].result
}
