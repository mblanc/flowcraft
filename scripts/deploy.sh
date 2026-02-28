#!/bin/bash
set -e

# This script deploys the application using Terraform.

# Check if terraform is installed
if ! command -v terraform &> /dev/null
then
    echo "terraform could not be found. Please install it."
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null
then
    echo "gcloud could not be found. Please install it."
    exit 1
fi

# Navigate to terraform directory relative to the script
cd "$(dirname "$0")/../terraform"

# Initialize terraform
echo "Initializing Terraform..."
terraform init

# Plan terraform
echo "Planning Terraform..."
terraform plan -out=tfplan

# Apply terraform
echo "Applying Terraform..."
terraform apply tfplan

echo "Deployment complete!"
