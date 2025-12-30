# -----------------------------------------------------------------------------
# Cloud Storage Bucket for User Avatars
# -----------------------------------------------------------------------------

resource "google_storage_bucket" "user_avatars" {
  name          = "${var.project_id}-user-avatars"
  project       = var.project_id
  location      = var.region
  force_destroy = false # Prevent accidental deletion

  uniform_bucket_level_access = true

  # CORS configuration for direct browser uploads
  cors {
    origin          = ["https://*.34.142.82.161.nip.io"]
    method          = ["GET", "PUT", "POST"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  # Lifecycle rules to manage storage costs
  lifecycle_rule {
    condition {
      age = 30 # Delete avatars not accessed in 30 days
      matches_prefix = ["temp/"]
    }
    action {
      type = "Delete"
    }
  }

  # Enable versioning for accidental deletions
  versioning {
    enabled = true
  }
}

# -----------------------------------------------------------------------------
# IAM for user-service to generate signed URLs
# -----------------------------------------------------------------------------

# Service account for user-service to manage avatars
resource "google_service_account" "user_service" {
  account_id   = "${var.cluster_name}-user-service"
  project      = var.project_id
  display_name = "User Service"
  description  = "Service account for user-service to generate signed URLs for avatar uploads"
}

# Grant user-service permission to create signed URLs
resource "google_storage_bucket_iam_member" "user_service_object_admin" {
  bucket = google_storage_bucket.user_avatars.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.user_service.email}"
}

# Allow user-service pods to use this service account via Workload Identity
resource "google_service_account_iam_member" "user_service_workload_identity" {
  service_account_id = google_service_account.user_service.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[apps/user-service]"
}

# -----------------------------------------------------------------------------
# Public read access for avatars (users upload private, then we make public)
# -----------------------------------------------------------------------------

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.user_avatars.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
