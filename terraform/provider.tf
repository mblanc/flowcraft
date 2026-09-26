terraform {
  required_version = ">= 1.16.4"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.46"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
