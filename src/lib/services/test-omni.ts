import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const PROJECT_ID = process.env.PROJECT_ID || "svc-demo-vertex";
const LOCATION = process.env.LOCATION || "global";

const ai = new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION,
});

async function runTest() {
    const inputParts = [
        {
            type: "image",
            uri: "gs://flowcraft-svc-demo-vertex/36b56363-9e32-4ce2-a101-2c73b3cbc7d7.png",
            mime_type: "image/png",
        },
        {
            type: "video",
            uri: "gs://flowcraft-svc-demo-vertex/07e1210b-d541-46f4-9754-1b6dc5dd32a6.mp4",
            mime_type: "video/mp4",
        },
        {
            type: "text",
            text: "A simple test prompt.",
        },
    ];

    const payload = {
        model: "gemini-omni-flash-preview",
        input: inputParts,
        response_format: {
            type: "video",
            delivery: "uri",
            gcs_uri: "gs://flowcraft-svc-demo-vertex/omni-test-connection.mp4",
        },
        generation_config: {
            video_config: {
                task: "edit",
            },
        },
    };

    console.log("\n--- Running Connection Test ---");
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (ai.interactions as any).create(payload);
        console.log(`SUCCESS! Response ID: ${response.id}`);
    } catch (err) {
        const error = err as Error & { status?: number };
        console.error(`FAILED! Error status: ${error.status}`);
        console.error(`Message: ${error.message}`);
    }
}

runTest().catch(console.error);
