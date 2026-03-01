variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "The name of the Cloud Run service"
  type        = string
  default     = "flowcraft"
}

variable "firestore_database_id" {
  description = "The ID of the Firestore database"
  type        = string
  default     = "flowcraft-db"
}

variable "auth_secret" {
  description = "The AUTH_SECRET for NextAuth"
  type        = string
  sensitive   = true
}

variable "auth_google_id" {
  description = "The Google OAuth Client ID"
  type        = string
}

variable "auth_google_secret" {
  description = "The Google OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "next_auth_url" {
  description = "The NEXT_AUTH_URL"
  type        = string
}

variable "admin_emails" {
  description = "Comma separated list of admin emails"
  type        = string
  default     = ""
}
