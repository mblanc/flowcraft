import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { geminiService } from "@/lib/services/gemini.service";
import logger from "@/app/logger";
import { createPartFromUri, createPartFromText } from "@google/genai";

const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        content: { type: "string" },
    },
    required: ["name", "description", "content"],
};

const ANALYSIS_SYSTEM_PROMPT = `You are a visual style analyst and creative director specializing in AI image generation prompts.
Analyze the provided reference images and produce a comprehensive STYLE.md document following these best practices:

A STYLE.md defines Creative Direction Tokens — the technical parameters of the "camera" and "canvas" that ensure every generated image looks like it belongs to the same brand family. It must be specific, not generic.

Structure your output as follows:
- name: A short, evocative name for this visual style (2-4 words)
- description: A single compelling tagline (max 15 words) that captures the essence
- content: A complete STYLE.md markdown document with these sections:
  1. Primary Medium & Technique (camera, film stock, rendering technique, line quality)
  2. Lighting & Atmosphere (direction, quality, time of day, mood, color temperature)
  3. Color Science (shadow tones, highlight tones, palette behavior, grading approach)
  4. Composition Rules (framing, subject placement, depth of field, vantage point)
  5. Negative Constraints (specific "never do" rules derived from the images)

Be precise and technical. Use specific f-stops, color temperatures (Kelvin), and material descriptions. The output will be used as a system instruction for an AI image generation model, so it must be actionable.`;

export const POST = withAuth(async (req) => {
    try {
        const body = await req.json();
        const { referenceImageUris } = body as { referenceImageUris: string[] };

        if (!referenceImageUris?.length) {
            return NextResponse.json(
                { error: "At least one reference image is required" },
                { status: 400 },
            );
        }

        const imageParts = referenceImageUris.map((uri: string) => {
            const ext = uri.split(".").pop()?.toLowerCase();
            const mimeType =
                ext === "jpg" || ext === "jpeg"
                    ? "image/jpeg"
                    : ext === "webp"
                      ? "image/webp"
                      : ext === "gif"
                        ? "image/gif"
                        : "image/png";
            return createPartFromUri(uri, mimeType);
        });

        const textPart = createPartFromText(
            "Analyze these reference images and generate a comprehensive STYLE.md document that captures their visual identity.",
        );

        const response = await geminiService.generateStructured({
            contents: [{ role: "user", parts: [...imageParts, textPart] }],
            systemInstruction: ANALYSIS_SYSTEM_PROMPT,
            responseSchema: RESPONSE_SCHEMA,
        });

        const candidate = response.candidates?.[0];
        const text = candidate?.content?.parts?.find((p) => p.text)?.text;

        if (!text) {
            throw new Error("No response from Gemini");
        }

        let result: { name: string; description: string; content: string };
        try {
            result = JSON.parse(text) as typeof result;
        } catch (parseError) {
            logger.error("Failed to parse Gemini response as JSON:", {
                parseError,
                rawText: text,
            });
            return NextResponse.json(
                { error: "Failed to parse style generation response" },
                { status: 502 },
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        logger.error("Error generating style:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
