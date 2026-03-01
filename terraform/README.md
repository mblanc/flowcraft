# Terraform Deployment for FlowCraft

This directory contains the Terraform configuration to provision the infrastructure for FlowCraft on Google Cloud Platform (GCP).

## 🏗️ Infrastructure Overview

The Terraform script provisions the following resources:

- **APIs**: Enables Cloud Run, Artifact Registry, Firestore, Storage, Secret Manager, Vertex AI, and Cloud Build.
- **Service Account**: Creates a dedicated service account (`flowcraft-sa`) with the necessary IAM roles.
- **Storage**: Creates a GCS bucket for media assets with CORS enabled (`origin: *`).
- **Firestore**: Creates a named Firestore database (`flowcraft-db`) and specific composite indexes for the `flows` and `custom_nodes` collections.
- **Artifact Registry**: Creates a Docker repository for container images.
- **Secret Manager**: Creates secrets for sensitive environment variables (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_AUTH_URL`).
- **Build**: Triggers a Docker build and push to Artifact Registry via Cloud Build using a `null_resource`.
- **Cloud Run**: Deploys the application as a Cloud Run service with 1 CPU and 2GiB RAM.

## 📋 Prerequisites

- **Google Cloud Project**: You must have an active GCP project.
- **Google Cloud SDK**: [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated.
- **Terraform**: [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) (>= 1.0) installed.
- **Permissions**: You must have the `Owner` or `Editor` role on the GCP project to create resources.

## 🚀 Deployment Instructions

### 1. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud auth application-default login
```

### 2. Configure Variables

Copy the template to create your own `terraform.tfvars` file:

```bash
cp terraform.tfvars.template terraform.tfvars
```

Edit `terraform.tfvars` and provide values for the required variables:

- `project_id`: Your GCP project ID.
- `auth_secret`: A random string for NextAuth.
- `auth_google_id`: Your Google OAuth Client ID.
- `auth_google_secret`: Your Google OAuth Client Secret.
- `next_auth_url`: The public URL of your application (e.g., `https://flowcraft-XXXXX-uc.a.run.app`).

### 3. Deploy

You can use the provided deployment script from the project root:

```bash
./scripts/deploy.sh
```

Alternatively, you can run Terraform manually from this directory:

```bash
terraform init
terraform apply
```

## 🔐 Important Notes

- **Secrets**: Sensitive values like OAuth credentials are stored in Google Secret Manager and referenced by Cloud Run at runtime.
- **State**: The Terraform state is currently stored locally in `terraform.tfstate`. For production environments, it is recommended to use a [GCS backend](https://developer.hashicorp.com/terraform/language/settings/backends/gcs).
- **Public Access**: The Cloud Run service is configured with `allUsers` access by default to allow public traffic.
- **Redeployment**: The Cloud Run service is configured with a `deploy-timestamp` annotation to force a new revision every time you run `terraform apply`.
