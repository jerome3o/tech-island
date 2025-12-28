# -----------------------------------------------------------------------------
# Project Configuration
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "europe-west2" # London
}

variable "environment" {
  description = "Environment name (e.g., prod, staging)"
  type        = string
  default     = "prod"
}

# -----------------------------------------------------------------------------
# GKE Configuration
# -----------------------------------------------------------------------------

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "tech-island"
}

variable "gke_num_nodes" {
  description = "Number of nodes in the default node pool"
  type        = number
  default     = 2
}

variable "gke_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-medium" # 2 vCPU, 4GB RAM - good balance of cost/performance
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------

variable "enable_cloud_sql" {
  description = "Whether to create a Cloud SQL PostgreSQL instance"
  type        = bool
  default     = true
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro" # Smallest tier, good for dev/small apps
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 10
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

variable "create_static_ip" {
  description = "Whether to create a static IP for the ingress"
  type        = bool
  default     = true
}
