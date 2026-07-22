terraform {
  required_version = ">= 1.15.8"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.41"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
