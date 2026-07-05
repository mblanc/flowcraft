import * as dotenv from "dotenv";
import * as path from "path";
// Load env vars first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { config } from "../config";
console.log("LOADED CONFIG:", JSON.stringify(config, null, 2));

import { geminiService } from "./gemini.service";

async function main() {
    try {
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

        console.log("SUCCESS! Result:", JSON.stringify(result, null, 2));
    } catch (err) {
        const error = err as Error & { body?: unknown };
        console.error("FAILED! Error name:", error.name);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        if (error.body) {
            console.error("Body:", error.body);
        }
    }
}

main().catch(console.error);
