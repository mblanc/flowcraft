## 2026-02-23 - GCS URI SSRF & Unauthorized Access
**Vulnerability:** Lack of validation for Google Cloud Storage (GCS) URIs allowed potential Server-Side Request Forgery (SSRF) and unauthorized data access. An attacker could provide a `gs://` URI from a different bucket, and the application would process it if the service account had permissions.
**Learning:** Even with cloud-native SDKs, user-provided resource identifiers (like GCS URIs) must be validated against an allowlist (e.g., the configured application bucket) to maintain isolation.
**Prevention:** Implement a central `validateGcsUri` utility and enforce its use at all API boundaries and service layers that handle GCS URIs. Integrate validation into Zod schemas for early failure.
