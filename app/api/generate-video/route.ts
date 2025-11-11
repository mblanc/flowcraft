import { NextResponse } from "next/server"
import { GoogleGenAI, GenerateVideosParameters, VideoGenerationReferenceType } from "@google/genai"

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

    const ai = new GoogleGenAI({ vertexai: true, project: process.env.PROJECT_ID, location: process.env.LOCATION })

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
        outputGcsUri: process.env.GCS_STORAGE_URI,
      },
    }

    if (firstFrame && firstFrame.startsWith("gs://")) {
      videoRequest.source!.image = {
        gcsUri: firstFrame,
        mimeType: "image/png",
      }
    }

    if (lastFrame && lastFrame.startsWith("gs://")) {
      videoRequest.config!.lastFrame = {
        gcsUri: lastFrame,
        mimeType: "image/png",
      }
    }

    if (images && images.length > 0) {
      videoRequest.config!.referenceImages = images.map((image:string) => {
        const base64Data = image.split(",")[1]
        const mimeType = image.split(";")[0].split(":")[1]
        return {
          image: {
            imageBytes: base64Data,
            mimeType: mimeType,
          },
          referenceType: VideoGenerationReferenceType.ASSET,
        }
      })
      console.log("[SERVER] Reference images:", JSON.stringify(videoRequest.config!.referenceImages, null, 2))
    }

    console.log("[SERVER] Calling Veo API")
    let operation = await ai.models.generateVideos(videoRequest)

    console.log("[SERVER] Waiting for video generation to complete...")
    let pollCount = 0
    const maxPolls = 60

    while (!operation.done && pollCount < maxPolls) {
      console.log(`[SERVER] Polling... (${pollCount + 1}/${maxPolls})`)
      operation = await ai.operations.get({ operation: operation })
      await delay(5000)
      pollCount++
    }

    if (!operation.done) {
      throw new Error("Video generation timed out")
    }

    const videos = operation.response?.generatedVideos
    if (!videos || videos.length === 0) {
      console.log(JSON.stringify(operation.response, null, 2) )
      throw new Error("No videos generated")
    }

    console.log("[SERVER] Video generated successfully, downloading...")

    const videoUri = videos[0]?.video?.uri
    if (!videoUri) {
      throw new Error("Video URI is not defined")
    }

    return NextResponse.json({ videoUrl: videoUri })
  } catch (error) {
    console.error("[v0] Error generating video:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate video" },
      { status: 500 },
    )
  }
}
