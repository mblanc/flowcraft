import Module from "node:module";

// TypeScript 7.0 does not ship the JS compiler API required by typescript-eslint.
// Route CJS require("typescript") to @typescript/typescript6 inside ESLint per:
// https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "typescript" || request.startsWith("typescript/")) {
        request = request.replace(/^typescript/, "@typescript/typescript6");
    }
    return origResolveFilename.call(this, request, parent, isMain, options);
};

const { default: nextCoreWebVitals } =
    await import("eslint-config-next/core-web-vitals");
const { default: nextTypescript } =
    await import("eslint-config-next/typescript");
const { default: prettierPlugin } = await import("eslint-plugin-prettier");
const { default: prettierConfig } = await import("eslint-config-prettier");

/** @type {import('eslint').Linter.Config[]} */
const config = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    prettierConfig,
    {
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            "prettier/prettier": ["error", { tabWidth: 4 }],
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            ".next-e2e/**",
            "out/**",
            "build/**",
            "next-env.d.ts",
            ".agents/**",
        ],
    },
];

export default config;
