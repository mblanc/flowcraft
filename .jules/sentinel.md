## 2026-02-24 - GCS Bucket Access Validation
**Vulnerability:** Unauthorized GCS bucket access via unvalidated GCS URIs.
**Learning:** Functions accepting `gs://` URIs directly from user input allowed access to any bucket reachable by the service account's IAM permissions. This bypassed application-level bucket restrictions.
**Prevention:** Implement a centralized `validateGcsUri` function that extracts the bucket name from all user-provided GCS URIs and compares it against an authorized bucket name configured in environment variables. Call this validation in all service layers (Storage, Gemini, etc.) before performing any GCS operations.
