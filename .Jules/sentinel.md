## 2026-02-25 - GCS Bucket Validation
**Vulnerability:** Potential SSRF and Unauthorized Access through manipulated GCS URIs.
**Learning:** Functions that accept GCS URIs from users often trust the bucket name in the URI, allowing access to any bucket the service account has permissions for.
**Prevention:** Always validate user-provided GCS URIs against an allowed list of buckets (usually configured in environment variables) before processing them.
