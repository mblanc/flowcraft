"use client"

import {
  useFlow,
  type AgentData,
  type TextData,
  type ImageData,
  type VideoData,
  type FileData,
} from "./flow-provider"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Button } from "./ui/button"
import { Plus, Trash2 } from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"

function AgentConfig({ data, nodeId }: { data: AgentData; nodeId: string }) {
  const { updateNodeData } = useFlow()


  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => updateNodeData(nodeId, { name: e.target.value })}
          placeholder="Agent name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Select value={data.model} onValueChange={(value) => updateNodeData(nodeId, { model: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
            <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
            <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          value={data.instructions}
          onChange={(e) => updateNodeData(nodeId, { instructions: e.target.value })}
          placeholder="System instructions for the agent..."
          rows={6}
          className="font-mono text-xs"
        />
      </div>

    </div>
  )
}

function ImageConfig({ data, nodeId }: { data: ImageData; nodeId: string }) {
  const { updateNodeData } = useFlow()
  const [signedImageUrls, setSignedImageUrls] = useState<string[]>([])

  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls = await Promise.all(
        data.images.map(async (image) => {
          if (image.startsWith("gs://")) {
            try {
              const res = await fetch(`/api/signed-url?gcsUri=${encodeURIComponent(image)}`)
              const result = await res.json()
              if (result.signedUrl) {
                return result.signedUrl
              } else {
                console.error("Failed to get signed URL:", result.error)
                return "/placeholder.svg"
              }
            } catch (error) {
              console.error("Error fetching signed URL:", error)
              return "/placeholder.svg"
            }
          } else {
            return image
          }
        })
      )
      setSignedImageUrls(urls)
    }

    fetchSignedUrls()
  }, [data.images])

  const addImage = () => {
    const newImages = [...data.images, "https://placeholder.com/300x300"]
    updateNodeData(nodeId, { images: newImages })
  }

  const removeImage = (index: number) => {
    const newImages = data.images.filter((_, i) => i !== index)
    updateNodeData(nodeId, { images: newImages })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => updateNodeData(nodeId, { name: e.target.value })}
          placeholder="Image node name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          value={data.prompt}
          onChange={(e) => updateNodeData(nodeId, { prompt: e.target.value })}
          placeholder="Image generation prompt..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aspectRatio">Aspect Ratio</Label>
        <Select
          value={data.aspectRatio}
          onValueChange={(value) => updateNodeData(nodeId, { aspectRatio: value as "16:9" | "9:16" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="9:16">9:16</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Select
          value={data.model}
          onValueChange={(value) => updateNodeData(nodeId, { model: value as ImageData["model"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</SelectItem>
            <SelectItem value="imagen-4.0-generate-001">Imagen 4.0</SelectItem>
            <SelectItem value="imagen-4.0-fast-generate-001">Imagen 4.0 Fast</SelectItem>
            <SelectItem value="imagen-4.0-ultra-generate-001">Imagen 4.0 Ultra</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resolution">Resolution</Label>
        <Select
          value={data.resolution}
          onValueChange={(value) => updateNodeData(nodeId, { resolution: value as "1K" | "2K" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1K">1K</SelectItem>
            <SelectItem value="2K">2K</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Images</Label>
          <Button onClick={addImage} size="sm" variant="outline" className="h-8 bg-transparent">
            <Plus className="h-4 w-4 mr-1" />
            Add Image
          </Button>
        </div>

        {signedImageUrls.length > 0 ? (
          <div className="space-y-2">
            {signedImageUrls.map((image, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border border-border rounded-md bg-card">
                <Image
                  src={image || "/placeholder.svg"}
                  alt={`Image ${index + 1}`}
                  width={48}
                  height={48}
                  className="object-cover rounded"
                />
                <span className="flex-1 text-xs text-muted-foreground truncate">{data.images[index]}</span>
                <Button
                  onClick={() => removeImage(index)}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No images added yet</p>
        )}
      </div>
    </div>
  )
}

function VideoConfig({ data, nodeId }: { data: VideoData; nodeId: string }) {
  const { updateNodeData } = useFlow()
  const [signedRefImageUrls, setSignedRefImageUrls] = useState<string[]>([])

  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls = await Promise.all(
        data.images.map(async (image) => {
          if (image.startsWith("gs://")) {
            try {
              const res = await fetch(`/api/signed-url?gcsUri=${encodeURIComponent(image)}`)
              const result = await res.json()
              if (result.signedUrl) {
                return result.signedUrl
              } else {
                console.error("Failed to get signed URL:", result.error)
                return "/placeholder.svg"
              }
            } catch (error) {
              console.error("Error fetching signed URL:", error)
              return "/placeholder.svg"
            }
          } else {
            return image
          }
        })
      )
      setSignedRefImageUrls(urls)
    }

    fetchSignedUrls()
  }, [data.images])

  const addImage = () => {
    const newImages = [...data.images, "https://placeholder.com/300x300"]
    updateNodeData(nodeId, { images: newImages })
  }

  const removeImage = (index: number) => {
    const newImages = data.images.filter((_, i) => i !== index)
    updateNodeData(nodeId, { images: newImages })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => updateNodeData(nodeId, { name: e.target.value })}
          placeholder="Video node name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          value={data.prompt}
          onChange={(e) => updateNodeData(nodeId, { prompt: e.target.value })}
          placeholder="Video generation prompt..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aspectRatio">Aspect Ratio</Label>
        <Select
          value={data.aspectRatio}
          onValueChange={(value) => updateNodeData(nodeId, { aspectRatio: value as "16:9" | "9:16" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="9:16">9:16</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Duration (seconds)</Label>
        <Select
          value={String(data.duration)}
          onValueChange={(value) => updateNodeData(nodeId, { duration: Number(value) as 4 | 6 | 8 })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4">4 seconds</SelectItem>
            <SelectItem value="6">6 seconds</SelectItem>
            <SelectItem value="8">8 seconds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">Model</Label>
        <Select
          value={data.model}
          onValueChange={(value) => updateNodeData(nodeId, { model: value as VideoData["model"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="veo-3.1-fast-generate-preview">Veo 3.1 Fast</SelectItem>
            <SelectItem value="veo-3.1-generate-preview">Veo 3.1</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="generateAudio">Generate Audio</Label>
        <Select
          value={String(data.generateAudio)}
          onValueChange={(value) => updateNodeData(nodeId, { generateAudio: value === "true" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resolution">Resolution</Label>
        <Select
          value={data.resolution}
          onValueChange={(value) => updateNodeData(nodeId, { resolution: value as "720p" | "1080p" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="720p">720p</SelectItem>
            <SelectItem value="1080p">1080p</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Reference Images</Label>
          <Button onClick={addImage} size="sm" variant="outline" className="h-8 bg-transparent">
            <Plus className="h-4 w-4 mr-1" />
            Add Image
          </Button>
        </div>

        {signedRefImageUrls.length > 0 ? (
          <div className="space-y-2">
            {signedRefImageUrls.map((image, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border border-border rounded-md bg-card">
                <Image
                  src={image || "/placeholder.svg"}
                  alt={`Image ${index + 1}`}
                  width={48}
                  height={48}
                  className="object-cover rounded"
                />
                <span className="flex-1 text-xs text-muted-foreground truncate">{data.images[index]}</span>
                <Button
                  onClick={() => removeImage(index)}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No images added yet</p>
        )}
      </div>
    </div>
  )
}

function FileConfig({ data, nodeId }: { data: FileData; nodeId: string }) {
  const { updateNodeData } = useFlow()
  const [signedFileUrl, setSignedFileUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (data.fileUrl && data.fileUrl.startsWith("gs://")) {
        try {
          const res = await fetch(`/api/signed-url?gcsUri=${encodeURIComponent(data.fileUrl)}`)
          const result = await res.json()
          if (result.signedUrl) {
            setSignedFileUrl(result.signedUrl)
          } else {
            console.error("Failed to get signed URL:", result.error)
            setSignedFileUrl("/placeholder.svg")
          }
        } catch (error) {
          console.error("Error fetching signed URL:", error)
          setSignedFileUrl("/placeholder.svg")
        }
      } else if (data.fileUrl) {
        setSignedFileUrl(data.fileUrl)
      } else {
        setSignedFileUrl(undefined)
      }
    }

    fetchSignedUrl()
  }, [data.fileUrl])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => updateNodeData(nodeId, { name: e.target.value })}
          placeholder="File node name"
        />
      </div>

      <div className="space-y-2">
        <Label>File Type</Label>
        <div className="text-sm text-muted-foreground">
          {data.fileType ? <span className="capitalize">{data.fileType}</span> : "No file uploaded"}
        </div>
      </div>

      {data.fileName && (
        <div className="space-y-2">
          <Label>File Name</Label>
          <div className="text-sm text-muted-foreground break-all">{data.fileName}</div>
        </div>
      )}

      {data.fileUrl && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="rounded-md overflow-hidden border border-border">
            {data.fileType === "image" && signedFileUrl ? (
              <Image src={signedFileUrl} alt={data.fileName} width={300} height={200} className="w-full h-auto" />
            ) : data.fileType === "video" ? (
              <video src={signedFileUrl || data.fileUrl} controls className="w-full h-auto" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function TextConfig({ data, nodeId }: { data: TextData; nodeId: string }) {
  const { updateNodeData } = useFlow()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => updateNodeData(nodeId, { name: e.target.value })}
          placeholder="Text node name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="text">Text</Label>
        <Textarea
          id="text"
          value={data.text}
          onChange={(e) => updateNodeData(nodeId, { text: e.target.value })}
          placeholder="Enter text content..."
          rows={8}
        />
      </div>
    </div>
  )
}

export function ConfigPanel() {
  const { selectedNode } = useFlow()

  if (!selectedNode) return null

  const { data, id } = selectedNode

  if (data.type === "agent") {
    return <AgentConfig data={data as AgentData} nodeId={id} />
  }

  if (data.type === "text") {
    return <TextConfig data={data as TextData} nodeId={id} />
  }

  if (data.type === "image") {
    return <ImageConfig data={data as ImageData} nodeId={id} />
  }

  if (data.type === "video") {
    return <VideoConfig data={data as VideoData} nodeId={id} />
  }

  if (data.type === "file") {
    return <FileConfig data={data as FileData} nodeId={id} />
  }

  return null
}
