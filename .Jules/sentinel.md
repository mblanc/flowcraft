## 2026-02-26 - GCS Bucket Access Control
**Vulnerability:** User-provided Google Cloud Storage (GCS) URIs were parsed without validating the bucket name against the application's configured bucket.
**Learning:** Functions like `getSignedUrlFromGCS` and `gcsUriToSharp` implicitly trusted the bucket name provided in the `gs://` URI, allowing potential SSRF or unauthorized access to other buckets accessible by the service account.
**Prevention:** Always use a centralized validation function (e.g., `validateAndParseGcsUri`) to verify that user-provided storage URIs point to authorized buckets before performing any operations on them.

## 2026-02-26 - Next.js Middleware Naming
**Learning:** In this repository's Next.js 16.1.6 environment, the middleware file MUST be named `proxy.ts`. The standard `middleware.ts` convention is deprecated and will cause the dev server to warn and potentially fail if not followed.
