import { AgentData, ImageData, NodeData, UpscaleData, VideoData } from "./types"
import { Node } from "@xyflow/react"

export interface ExecutionContext {
    updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
}

export async function executeAgentNode(
    node: Node<AgentData>,
    inputs: { prompt?: string; files?: { url: string; type: string }[] },
): Promise<Partial<AgentData>> {
    const { prompt, files } = inputs
    const finalPrompt = prompt || node.data.instructions

    if (!finalPrompt) {
        throw new Error("No prompt available for agent node")
    }

    console.log("[Executor] Generating text with prompt:", finalPrompt)

    const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: finalPrompt,
            files: files || [],
            model: node.data.model,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to generate text: ${errorText}`)
    }

    const data = await response.json()
    return { output: data.text }
}

export async function executeImageNode(
    node: Node<ImageData>,
    inputs: { prompt?: string; images?: string[] },
): Promise<Partial<ImageData>> {
    const { prompt, images } = inputs
    const finalPrompt = prompt || node.data.prompt

    if (!finalPrompt) {
        throw new Error("No prompt available for image node")
    }

    console.log("[Executor] Generating image with prompt:", finalPrompt)

    const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: finalPrompt,
            images: images || [],
            aspectRatio: node.data.aspectRatio,
            model: node.data.model,
            resolution: node.data.resolution,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to generate image: ${errorText}`)
    }

    const data = await response.json()
    return { images: [data.imageUrl] }
}

export async function executeVideoNode(
    node: Node<VideoData>,
    inputs: { prompt?: string; firstFrame?: string; lastFrame?: string; images?: string[] },
): Promise<Partial<VideoData>> {
    const { prompt, firstFrame, lastFrame, images } = inputs
    const finalPrompt = prompt || node.data.prompt

    if (!finalPrompt) {
        throw new Error("No prompt available for video node")
    }

    console.log("[Executor] Generating video with prompt:", finalPrompt)

    const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: finalPrompt,
            firstFrame,
            lastFrame,
            images: images || [],
            aspectRatio: node.data.aspectRatio,
            duration: node.data.duration,
            model: node.data.model,
            generateAudio: node.data.generateAudio,
            resolution: node.data.resolution,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to generate video: ${errorText}`)
    }

    const data = await response.json()
    return {
        videoUrl: data.videoUrl,
        firstFrame,
        lastFrame,
    }
}

export async function executeUpscaleNode(
    node: Node<UpscaleData>,
    inputs: { image?: string },
): Promise<Partial<UpscaleData>> {
    const { image } = inputs
    const finalImage = image || node.data.image

    if (!finalImage) {
        throw new Error("No image available for upscale node")
    }

    console.log("[Executor] Upscaling image")

    // Note: Assuming there is an upscale API endpoint, though it wasn't visible in the file list earlier.
    // If not, we might need to mock it or check if it exists.
    // Based on FlowProvider, it seems to use /api/upscale-image (inferred).
    // Let's check the file list again or assume it exists.
    // The file list showed `upscale-image` directory in `app/api`.

    const response = await fetch("/api/upscale-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image: finalImage,
            upscaleFactor: node.data.upscaleFactor,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to upscale image: ${errorText}`)
    }

    const data = await response.json()
    return { image: data.imageUrl } // Assuming the API returns imageUrl
}
