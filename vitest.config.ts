import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        include: ["**/*.test.{ts,tsx}"],
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
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./"),
        },
    },
});
