import { GoogleGenAI, createPartFromBase64, createPartFromUri, createPartFromText, ContentListUnion, Image } from "@google/genai"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const {
            image,
            upscaleFactor = "x2",
        } = await request.json()

        if (!image) {
            return NextResponse.json({ error: "Image is required" }, { status: 400 })
        }

        const ai = new GoogleGenAI({ vertexai: true, project: process.env.PROJECT_ID, location: process.env.LOCATION })

        console.log("[SERVER] Upscaling image with factor:", upscaleFactor)
        console.log("[SERVER] Image source:", image.substring(0, 50))

        let imageInput: Image = {}

        // Add the input image
        if (image.startsWith("data:image/")) {
            const base64Data = image.split(",")[1]
            const mimeType = image.split(";")[0].split(":")[1]
            imageInput.imageBytes = base64Data
            imageInput.mimeType = mimeType
        } else if (image.startsWith("gs://")) {
            imageInput.gcsUri = image
        } else {
            return NextResponse.json({ error: "Invalid image format" }, { status: 400 })
        }

        let response
        try {
            response = await ai.models.upscaleImage({
                model: "imagen-4.0-upscale-preview",
                image: imageInput,
                upscaleFactor: upscaleFactor,
                config: {
                    outputGcsUri: process.env.GCS_STORAGE_URI,
                    outputMimeType: "image/png",
                    enhanceInputImage: true,
                    imagePreservationFactor: 1.0,
                }
            })
        } catch (apiError: unknown) {
            console.error("[v0] Gemini API error:", apiError)
            if (apiError instanceof Error && apiError.message) {
                return NextResponse.json({ error: "Gemini API error", details: apiError.message }, { status: 500 })
            }
            throw apiError
        }

        console.log("[SERVER] Response received from Imagen 4 Upscale")

        if (!response.generatedImages || response.generatedImages.length === 0) {
            console.error("[SERVER] No generated images in response")
            return NextResponse.json({ error: "No candidates in response" }, { status: 500 })
        }

        const candidate = response.generatedImages[0]
        if (!candidate.image || !candidate.image.gcsUri) {
            console.error("[SERVER] No image in response")
            return NextResponse.json({ error: "No content parts in response" }, { status: 500 })
        }

        let imageGcsUri
        imageGcsUri = candidate.image.gcsUri
        return NextResponse.json({
            imageUrl: imageGcsUri,
            upscaleFactor,
        })
    } catch (error) {
        console.error("[SERVER] Error upscaling image:", error)
        return NextResponse.json(
            { error: "Failed to upscale image", details: error instanceof Error ? error.message : String(error) },
            { status: 500 },
        )
    }
}

