resource "null_resource" "docker_build" {
  triggers = {
    # Re-run if any source code file changes
    # For simplicity, we'll just use a timestamp to trigger on every apply
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = <<EOT
      gcloud builds submit .. \
        --project=${var.project_id} \
        --config ../scripts/cloudbuild.yaml \
        --substitutions _IMAGE_NAME=${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.name}/${var.service_name}:latest
    EOT
  }

  depends_on = [
    google_artifact_registry_repository.repo,
    google_project_service.services
  ]
}
