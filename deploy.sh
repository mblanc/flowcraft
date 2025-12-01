#!/bin/bash

# Configuration
PROJECT_ID="svc-demo-vertex"
REGION="us-central1"
SERVICE="flowcraft"
IMAGE_URI="us-central1-docker.pkg.dev/$PROJECT_ID/vertexai/$SERVICE:v1"

# 1. Build the container image using Cloud Build
# Using a config file for caching support.
echo "Building container image..."
gcloud builds submit --config cloudbuild.yaml --substitutions _IMAGE_NAME=$IMAGE_URI .

# 2. Deploy to Cloud Run
echo "Deploying to Cloud Run..."

# Reset the SECONDS variable to measure just the deploy step
SECONDS=0

gcloud run deploy $SERVICE \
  --image $IMAGE_URI \
  --cpu 1 \
  --memory 2G \
  --region $REGION \
  --set-env-vars PROJECT_ID="svc-demo-vertex",LOCATION="us-central1",FIRESTORE_DATABASE_ID="flowcraft-db",GCS_STORAGE_URI="gs://flowcraft-svc-demo-vertex/",AUTH_TRUST_HOST='true',AUTH_URL='https://flowcraft.mblanc.demo.altostrat.com' \
  --update-secrets=AUTH_SECRET=FLOWCRAFT_AUTH_SECRET:1,AUTH_GOOGLE_ID=FLOWCRAFT_AUTH_GOOGLE_ID:1,AUTH_GOOGLE_SECRET=FLOWCRAFT_AUTH_GOOGLE_SECRET:1,NEXT_AUTH_URL=FLOWCRAFT_NEXT_AUTH_URL:1

duration=$SECONDS
echo "----------------------------------------------------------------"
echo "Deployment complete."
echo "Time taken for deployment: $(($duration / 60)) minutes and $(($duration % 60)) seconds."
echo "----------------------------------------------------------------"