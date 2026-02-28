resource "google_cloud_run_v2_service" "default" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.flowcraft_sa.email

    # Use annotation to force a new revision on every apply
    annotations = {
      "deploy-timestamp" = null_resource.docker_build.triggers.always_run
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.name}/${var.service_name}:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
      }

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "LOCATION"
        value = "global"
      }
      env {
        name  = "FIRESTORE_DATABASE_ID"
        value = var.firestore_database_id
      }
      env {
        name  = "GCS_STORAGE_URI"
        value = "gs://${google_storage_bucket.assets.name}/"
      }
      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }
      env {
        name  = "ADMIN_EMAILS"
        value = var.admin_emails
      }

      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_GOOGLE_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_google_id.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_GOOGLE_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_google_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "NEXT_AUTH_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.next_auth_url.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    null_resource.docker_build,
    google_secret_manager_secret_version.auth_secret_version,
    google_secret_manager_secret_version.auth_google_id_version,
    google_secret_manager_secret_version.auth_google_secret_version,
    google_secret_manager_secret_version.next_auth_url_version
  ]
}

resource "google_cloud_run_v2_service_iam_member" "noauth" {
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "service_url" {
  value = google_cloud_run_v2_service.default.uri
}
