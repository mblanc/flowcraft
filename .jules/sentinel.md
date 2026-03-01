## 2026-02-28 - GCS URI Validation for SSRF Prevention
**Vulnerability:** Google Cloud Storage (GCS) operations were performed on arbitrary user-provided URIs without bucket validation, potentially allowing unauthorized access to other buckets in the same project or SSRF-like behavior.
**Learning:** Even internal-looking URIs (like `gs://`) must be treated as untrusted input when they originate from client-side or user-controlled parameters.
**Prevention:** Implement a centralized validation function that enforces a strict allowlist of buckets (based on application configuration) and validates the URI format before passing it to SDK functions.
