import { GoogleGenAI, createPartFromBase64, createPartFromUri, createPartFromText, ContentListUnion } from "@google/genai"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from 'uuid'
import { uploadImage } from "@/lib/storage"

export async function POST(request: Request) {
  try {
    const {
      prompt,
      images = [],
      aspectRatio = "16:9",
      model = "gemini-2.5-flash-image",
      resolution = "1K",
    } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const ai = new GoogleGenAI({ vertexai: true, project: process.env.GEMINI_PROJECT_ID, location: process.env.GEMINI_LOCATION })


    console.log("[v0] Generating image with prompt:", prompt)
    console.log("[v0] Number of input images:", images.length)
    console.log("[v0] Aspect ratio:", aspectRatio)
    console.log("[v0] Model:", model)
    console.log("[v0] Resolution:", resolution)

    const contentParts: ContentListUnion = []

    for (const imageUrl of images) {
      if (imageUrl.startsWith("data:image/")) {
        const base64Data = imageUrl.split(",")[1]
        const mimeType = imageUrl.split(";")[0].split(":")[1]
        contentParts.push(createPartFromBase64(base64Data, mimeType))
      } else if (imageUrl.startsWith("gs://")) {
        contentParts.push(createPartFromUri(imageUrl, "image/png"))
      }
    }

    contentParts.push(createPartFromText(prompt))

    console.log("[v0] Content parts count:", contentParts.length)

    let response
    try {
      response = await ai.models.generateContent({
        model: model,
        contents: contentParts,
        config: {
          responseModalities: ["IMAGE"],
          ...{ imageConfig: { aspectRatio: aspectRatio }},

        },
      })
    } catch (apiError: unknown) {
      console.error("[v0] Gemini API error:", apiError)
      if (apiError instanceof Error && apiError.message) {
        return NextResponse.json({ error: "Gemini API error", details: apiError.message }, { status: 500 })
      }
      throw apiError
    }

    console.log("[v0] Response received from Gemini")

    if (!response.candidates || response.candidates.length === 0) {
      console.error("[v0] No candidates in response")
      return NextResponse.json({ error: "No candidates in response" }, { status: 500 })
    }

    const candidate = response.candidates[0]
    if (!candidate.content || !candidate.content.parts) {
      console.error("[v0] No content parts in response")
      return NextResponse.json({ error: "No content parts in response" }, { status: 500 })
    }

    
    let imageGcsUri;
    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            const imageBuffer = Buffer.from(part.inlineData!.data!, "base64");
            const mimeType = part.inlineData!.mimeType!;
            const extension = mimeType.split("/")[1] || "png";
            const uuid = uuidv4()
            imageGcsUri = await uploadImage(imageBuffer.toString('base64'), `gemini-${uuid}.${extension}`)
            return NextResponse.json({
              imageUrl: imageGcsUri,
              prompt,
            });
        } else {
          console.log(response.text)
        }
    };

    console.error("[v0] No inline data found in response parts")
    return NextResponse.json({ error: "No image data in response" }, { status: 500 })
  } catch (error) {
    console.error("[v0] Error generating image:", error)
    return NextResponse.json(
      { error: "Failed to generate image", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
