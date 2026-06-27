terraform {
  required_version = ">= 1.15.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.38"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
