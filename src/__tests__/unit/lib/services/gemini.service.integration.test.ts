import * as dotenv from "dotenv";
import * as path from "path";
// Load env vars first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { config } from "@/lib/config";
console.log("CONFIG IN TEST FILE INITIALIZATION:", config);

import { describe, it, expect } from "vitest";
import { geminiService } from "@/lib/services/gemini.service";

describe("GeminiService Omni Integration Test", () => {
    it("should successfully generate video with gemini-omni-flash-preview on Vertex AI", async () => {
        console.log("CONFIG IN TEST RUN:", config);
        const result = await geminiService.generateVideo({
            model: "gemini-omni-flash-preview",
            prompt: "3D kinetic text spelling out the words 'you can add a Gemini Omni...' dynamically floats.",
            images: [
                {
                    url: "gs://flowcraft-svc-demo-vertex/36b56363-9e32-4ce2-a101-2c73b3cbc7d7.png",
                    type: "image/png",
                },
            ],
            video: "gs://flowcraft-svc-demo-vertex/07e1210b-d541-46f4-9754-1b6dc5dd32a6.mp4",
        });

        console.log("Integration test result:", result);
        expect(result).toBeDefined();
        expect(result).toHaveProperty("videoUrl");
        const videoUrl = (result as { videoUrl?: string }).videoUrl;
        expect(videoUrl?.startsWith("gs://")).toBe(true);
    }, 60000); // 60s timeout
});
