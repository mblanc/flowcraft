/**
 * Vitest config for agent eval tests.
 *
 * Eval tests hit real LLM APIs (Vertex AI / Gemini) and are skipped automatically
 * when PROJECT_ID is not set. Set credentials before running:
 *
 *   export PROJECT_ID=my-gcp-project
 *   export LOCATION=us-central1   # optional, defaults to "global"
 *   gcloud auth application-default login
 *   bun run test:eval
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["src/__tests__/eval/**/*.eval.test.ts"],
        testTimeout: 180_000,
        // Evals run the real LLM — no coverage or parallelism
        pool: "forks",
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});
