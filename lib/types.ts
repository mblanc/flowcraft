export type NodeType = "agent" | "text" | "image" | "video" | "file" | "upscale"

export interface BaseNodeData extends Record<string, unknown> {
  type: NodeType
  name: string
  executing?: boolean
}

export interface AgentData extends BaseNodeData {
  type: "agent"
  model: string
  instructions: string
  output?: string
}

export interface TextData extends BaseNodeData {
  type: "text"
  text: string
  width?: number
  height?: number
}

export interface ImageData extends BaseNodeData {
  type: "image"
  prompt: string
  images: string[]
  aspectRatio: "16:9" | "9:16" | "1:1" | "3:2" | "2:3" | "4:3" | "3:4" | "5:4" | "4:5" | "21:9"
  model:
  | "gemini-2.5-flash-image"
  | "gemini-3-pro-image-preview"
  | "imagen-4.0-generate-001"
  | "imagen-4.0-fast-generate-001"
  | "imagen-4.0-ultra-generate-001"
  resolution: "1K" | "2K" | "4K"
  width?: number
  height?: number
}

export interface VideoData extends BaseNodeData {
  type: "video"
  prompt: string
  images: string[]
  firstFrame?: string
  lastFrame?: string
  videoUrl?: string
  aspectRatio: "16:9" | "9:16"
  duration: 4 | 6 | 8
  model: "veo-3.1-fast-generate-preview" | "veo-3.1-generate-preview"
  generateAudio: boolean
  resolution: "720p" | "1080p"
}

export interface FileData extends BaseNodeData {
  type: "file"
  fileType: "image" | "video" | null
  fileUrl: string
  fileName: string
}

export interface UpscaleData extends BaseNodeData {
  type: "upscale"
  image: string
  upscaleFactor: "x2" | "x3" | "x4"
  width?: number
  height?: number
}

export interface NodeInputs {
  prompt?: string
  files?: { url: string; type: string }[]
  images?: string[]
  firstFrame?: string
  lastFrame?: string
  image?: string
}

export type NodeData = AgentData | TextData | ImageData | VideoData | FileData | UpscaleData
