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
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";
import path from "path";

// Load environment variables from .env.local
// Next.js loadEnvConfig skips .env.local when NODE_ENV === 'test'.
// We temporarily override NODE_ENV to load it for these live eval tests.
const originalNodeEnv = process.env.NODE_ENV;
(process.env as Record<string, string | undefined>).NODE_ENV = "development";
loadEnvConfig(process.cwd());
(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        setupFiles: ["./vitest.setup.eval.ts"],
        include: ["src/__tests__/eval/**/*.eval.test.ts"],
        testTimeout: 180_000,
        // Evals run the real LLM — no coverage or parallelism
        pool: "forks",
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});
