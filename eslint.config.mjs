import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

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
