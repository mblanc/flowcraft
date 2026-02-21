## 2026-02-21 - [GCS URI SSRF/Unauthorized Access Prevention]
**Vulnerability:** Application accepted arbitrary `gs://` URIs for signing and as inputs to Gemini models, potentially allowing an authenticated user to access any GCS object the service account could read.
**Learning:** Even with an authenticated session, input validation for cloud resources (GCS URIs, DB IDs) is critical to prevent cross-tenant or cross-resource data exfiltration if the backend service account is over-privileged.
**Prevention:** Always validate that user-provided resource identifiers (like GCS URIs) belong to the authorized/expected domain (e.g., the configured app bucket) at the service or utility layer.
