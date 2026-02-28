resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = var.firestore_database_id
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.services]
}

# Indexes for flows collection
resource "google_firestore_index" "flows_user_updated" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "flows"

  fields {
    field_path = "userId"
    order      = "ASCENDING"
  }
  fields {
    field_path = "updatedAt"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "flows_shared_updated" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "flows"

  fields {
    field_path = "sharedWithEmails"
    array_config = "CONTAINS"
  }
  fields {
    field_path = "updatedAt"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "flows_template_visibility_updated" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "flows"

  fields {
    field_path = "isTemplate"
    order      = "ASCENDING"
  }
  fields {
    field_path = "visibility"
    order      = "ASCENDING"
  }
  fields {
    field_path = "updatedAt"
    order      = "DESCENDING"
  }
}

# Index for custom_nodes collection
resource "google_firestore_index" "custom_nodes_user_updated" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "custom_nodes"

  fields {
    field_path = "userId"
    order      = "ASCENDING"
  }
  fields {
    field_path = "updatedAt"
    order      = "DESCENDING"
  }
}
