resource "google_service_account" "flowcraft_sa" {
  account_id   = "flowcraft-sa"
  display_name = "FlowCraft Service Account"
}

resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.flowcraft_sa.email}"
}

resource "google_project_iam_member" "storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.flowcraft_sa.email}"
}

resource "google_project_iam_member" "vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.flowcraft_sa.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.flowcraft_sa.email}"
}

# Bucket
resource "google_storage_bucket" "assets" {
  name          = "flowcraft-assets-${var.project_id}"
  location      = var.region
  force_destroy = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.services]
}

# Artifact Registry
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "flowcraft-repo"
  description   = "Docker repository for FlowCraft"
  format        = "DOCKER"

  depends_on = [google_project_service.services]
}
