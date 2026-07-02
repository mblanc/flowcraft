terraform {
  required_version = ">= 1.15.7"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.39"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
