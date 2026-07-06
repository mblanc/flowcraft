import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };

export default defineConfig({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [react() as any],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        include: ["src/__tests__/unit/**/*.test.{ts,tsx}"],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/*.integration.test.ts",
        ],
        testTimeout: 15000,
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            // Lines/statements meet >60%. Functions/branches are lower due to
            // complex UI components (ReactFlow nodes, config panels) and
            // event-driven hooks that require a full browser environment to test.
            thresholds: {
                lines: 60,
                statements: 60,
                functions: 50,
                branches: 45,
            },
        },
    },
    resolve: { alias },
});
