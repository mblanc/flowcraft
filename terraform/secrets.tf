resource "google_secret_manager_secret" "auth_secret" {
  secret_id = "AUTH_SECRET"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "auth_secret_version" {
  secret      = google_secret_manager_secret.auth_secret.id
  secret_data = var.auth_secret
}

resource "google_secret_manager_secret" "auth_google_id" {
  secret_id = "AUTH_GOOGLE_ID"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "auth_google_id_version" {
  secret      = google_secret_manager_secret.auth_google_id.id
  secret_data = var.auth_google_id
}

resource "google_secret_manager_secret" "auth_google_secret" {
  secret_id = "AUTH_GOOGLE_SECRET"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "auth_google_secret_version" {
  secret      = google_secret_manager_secret.auth_google_secret.id
  secret_data = var.auth_google_secret
}

resource "google_secret_manager_secret" "next_auth_url" {
  secret_id = "NEXT_AUTH_URL"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "next_auth_url_version" {
  secret      = google_secret_manager_secret.next_auth_url.id
  secret_data = var.next_auth_url
}
