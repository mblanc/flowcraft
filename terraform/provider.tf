terraform {
  required_version = ">= 1.16.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.7"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
