import { NextResponse } from "next/server"
import { GoogleGenAI, GenerateVideosParameters } from "@google/genai"

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  try {
    const { prompt, firstFrame, lastFrame, images, aspectRatio, duration, model, generateAudio, resolution } =
      await request.json()

    console.log("[SERVER] Generating video with Veo")
    console.log("[SERVER] Prompt:", prompt)
    console.log("[SERVER] Model:", model)
    console.log("[SERVER] Duration:", duration)
    console.log("[SERVER] Aspect Ratio:", aspectRatio)
    console.log("[SERVER] Generate Audio:", generateAudio)
    console.log("[SERVER] Resolution:", resolution)
    console.log("[SERVER] First frame:", firstFrame ? "Yes" : "No")
    console.log("[SERVER] Last frame:", lastFrame ? "Yes" : "No")
    console.log("[SERVER] Reference images:", images?.length || 0)

    const ai = new GoogleGenAI({ vertexai: true, project: process.env.GEMINI_PROJECT_ID, location: process.env.GEMINI_LOCATION })

    const videoRequest: GenerateVideosParameters = {
      model: model || "veo-3.1-fast-generate-preview",
      source: {
        prompt: prompt,
      },
      config: {
        numberOfVideos: 1,
        durationSeconds: duration || 4,
        aspectRatio: aspectRatio || "16:9",
        generateAudio: generateAudio !== false,
        resolution: resolution || "720p",
      },
    }

    if (firstFrame && firstFrame.startsWith("data:image/")) {
      const base64Data = firstFrame.split(",")[1]
      const mimeType = firstFrame.split(";")[0].split(":")[1]
      videoRequest.source!.image = {
        imageBytes: base64Data,
        mimeType: mimeType,
      }
    }

    if (lastFrame && lastFrame.startsWith("data:image/")) {
      const base64Data = lastFrame.split(",")[1]
      const mimeType = lastFrame.split(";")[0].split(":")[1]
      videoRequest.config!.lastFrame = {
        imageBytes: base64Data,
        mimeType: mimeType,
      }
    }

    console.log("[SERVER] Calling Veo API")
    let operation = await ai.models.generateVideos(videoRequest)

    console.log("[SERVER] Waiting for video generation to complete...")
    let pollCount = 0
    const maxPolls = 60

    while (!operation.done && pollCount < maxPolls) {
      console.log(`[SERVER] Polling... (${pollCount + 1}/${maxPolls})`)
      await delay(5000)
      operation = await ai.operations.get({ operation: operation })
      pollCount++
    }

    if (!operation.done) {
      throw new Error("Video generation timed out")
    }

    const videos = operation.response?.generatedVideos
    if (!videos || videos.length === 0) {
      throw new Error("No videos generated")
    }

    console.log("[SERVER] Video generated successfully, downloading...")

    const videoFile = videos[0].video
    console.log("[SERVER] Downloading video file...")

    const videoBytes = videos[0]?.video?.videoBytes
    if (!videoBytes) {
      throw new Error("Video bytes are not defined")
    }
    const videoUrl = `data:video/mp4;base64,${videoBytes}`

    console.log("[SERVER] Video downloaded and encoded to base64")

    return NextResponse.json({ videoUrl })
  } catch (error) {
    console.error("[v0] Error generating video:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate video" },
      { status: 500 },
    )
  }
}
