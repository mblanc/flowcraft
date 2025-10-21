import { GoogleGenAI, createPartFromBase64, createPartFromText, ContentListUnion } from "@google/genai"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { prompt, files, model } = await request.json()

    console.log("[SERVER] Generating text with model:", model)
    console.log("[SERVER] Prompt:", prompt)
    console.log("[SERVER] Number of files:", files?.length || 0)

    const ai = new GoogleGenAI({ vertexai: true, project: process.env.GEMINI_PROJECT_ID, location: process.env.GEMINI_LOCATION })

    // Build contents array with text and files
    const contents: ContentListUnion = [createPartFromText(prompt)]

    // Add files if provided
    if (files && files.length > 0) {
      for (const file of files) {
        // Extract base64 data from data URL
        const base64Match = file.url.match(/^data:([^;]+);base64,(.+)$/)
        if (base64Match) {
          const mimeType = base64Match[1]
          const base64Data = base64Match[2]
          contents.push(createPartFromBase64(base64Data, mimeType))
        }
      }
    }

    console.log("[SERVER] Calling Gemini API with model:", model || "gemini-2.0-flash-exp")

    const response = await ai.models.generateContent({
      model: model || "gemini-2.0-flash-exp",
      contents,
    })

    console.log("[SERVER] Response received from Gemini")

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No candidates in response")
    }

    const candidate = response.candidates[0]
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error("No content parts in response")
    }

    // Extract text from response
    let text = ""
    for (const part of candidate.content.parts) {
      if (part.text) {
        text += part.text
      }
    }

    console.log("[SERVER] Text generated successfully, length:", text.length)

    return NextResponse.json({ text })
  } catch (error) {
    console.error("[SERVER] Error generating text:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate text" },
      { status: 500 },
    )
  }
}
