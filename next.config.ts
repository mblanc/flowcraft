import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    // node-av ships a .node native addon that webpack cannot bundle.
    // Mark the entire mediabunny server stack as external so Next.js
    // requires them at runtime instead of attempting to bundle them.
    serverExternalPackages: [
        "sharp",
        "mediabunny",
        "@mediabunny/server",
        "node-av",
        "@seydx/node-av-darwin-x64",
        "@seydx/node-av-linux-x64",
        "@seydx/node-av-linux-arm64",
    ],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
            {
                protocol: "https",
                hostname: "storage.googleapis.com",
            },
        ],
    },
};

export default nextConfig;
