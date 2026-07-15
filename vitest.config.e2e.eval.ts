/**
 * Vitest config for isolated agent e2e evaluation tests.
 *
 * E2E tests perform real media generation (Imagen/Veo) and evaluate the output
 * using Gemini-as-a-judge. They are slower and more expensive.
 */
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";
import path from "path";

// Load environment variables from .env.local
const originalNodeEnv = process.env.NODE_ENV;
(process.env as Record<string, string | undefined>).NODE_ENV = "development";
loadEnvConfig(process.cwd());
(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        setupFiles: ["./vitest.setup.eval.ts"],
        include: ["src/__tests__/eval/**/*.e2e.eval.test.ts"],
        testTimeout: 300_000,
        pool: "forks",
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});
