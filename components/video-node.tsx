"use client"

import type React from "react"

import { memo, useRef, useEffect, useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { VideoData } from "@/lib/types"
import { Video, Play } from "lucide-react"
import { useFlow } from "./flow-provider"

export const VideoNode = memo(({ data, selected, id }: NodeProps<Node<VideoData>>) => {
  const { executeNode, updateNodeData } = useFlow()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localPrompt, setLocalPrompt] = useState(data.prompt)
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | undefined>(undefined)
  const [dimensions, setDimensions] = useState({
    width: data.width || 400,
    height: data.height || 600,
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  useEffect(() => {
    setLocalPrompt(data.prompt)
  }, [data.prompt])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [localPrompt])

  useEffect(() => {
    const fetchSignedUrl = async (gcsUri: string, setter: (url: string | undefined) => void) => {
      try {
        const response = await fetch(`/api/signed-url?gcsUri=${encodeURIComponent(gcsUri)}`)
        const data = await response.json()
        if (data.signedUrl) {
          setter(data.signedUrl)
        } else {
          console.error("Failed to get signed URL:", data.error)
          setter(undefined)
        }
      } catch (error) {
        console.error("Error fetching signed URL:", error)
        setter(undefined)
      }
    }

    if (data.videoUrl && data.videoUrl.startsWith("gs://")) {
      fetchSignedUrl(data.videoUrl, setVideoPlaybackUrl)
    } else {
      setVideoPlaybackUrl(data.videoUrl)
    }

  }, [data.videoUrl])

  useEffect(() => {
    if (data.width !== undefined && data.height !== undefined) {
      setDimensions({ width: data.width, height: data.height })
    }
  }, [data.width, data.height])

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: dimensions.width,
      height: dimensions.height,
    }
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.x
      const deltaY = e.clientY - resizeStartRef.current.y
      const newWidth = Math.max(220, resizeStartRef.current.width + deltaX)
      const newHeight = Math.max(300, resizeStartRef.current.height + deltaY)
      setDimensions({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      updateNodeData(id, { width: dimensions.width, height: dimensions.height })
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, id, updateNodeData, dimensions.width, dimensions.height])

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation()
    executeNode(id)
  }

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalPrompt(e.target.value)
  }

  const handleBlur = () => {
    updateNodeData(id, { prompt: localPrompt })
  }

  return (
    <div
      className={`bg-card border-2 rounded-lg p-4 shadow-lg transition-all relative ${selected ? "border-primary shadow-primary/20" : "border-border"
        } ${data.executing ? "animate-pulse-bg" : ""}`}
      style={{ width: dimensions.width }}
    >
      {/* Prompt Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="prompt-input"
        className="!bg-pink-500"
        style={{ top: 35, left: -6 }}
      />
      <div className="absolute right-full top-[18px] mr-5 whitespace-nowrap text-pink-500 text-xs font-semibold">
        Prompt
      </div>

      {/* First Frame Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="first-frame-input"
        className="!bg-blue-500"
        style={{ top: 65, left: -6 }}
      />
      <div className="absolute right-full top-[48px] mr-5 whitespace-nowrap text-blue-500 text-xs font-semibold">
        First Frame
      </div>

      {/* Last Frame Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="last-frame-input"
        className="!bg-purple-500"
        style={{ top: 95, left: -6 }}
      />
      <div className="absolute right-full top-[78px] mr-5 whitespace-nowrap text-purple-500 text-xs font-semibold">
        Last Frame
      </div>

      {/* Image(s) Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image-input"
        className="!bg-green-500"
        style={{ top: 125, left: -6 }}
      />
      <div className="absolute right-full top-[108px] mr-5 whitespace-nowrap text-green-500 text-xs font-semibold">
        Image(s)
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-pink-500/10 flex items-center justify-center">
          <Video className="h-5 w-5 text-pink-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{data.name}</h3>
          <textarea
            ref={textareaRef}
            value={localPrompt}
            onChange={handlePromptChange}
            onBlur={handleBlur}
            placeholder="Enter prompt..."
            className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none resize-none overflow-hidden focus:text-foreground transition-colors nodrag mb-2 break-words"
            rows={1}
          />
          <div className="text-xs text-muted-foreground">
            Video {data.videoUrl && "(Generated)"}
            {data.executing && <span className="ml-2 text-pink-400">Generating...</span>}
          </div>
        </div>
      </div>

      {data.videoUrl && (
        <div className="mt-3 rounded-md overflow-hidden border border-border" style={{ maxHeight: dimensions.height - 200 }}>
          <video src={videoPlaybackUrl} controls className="w-full h-auto object-contain" style={{ maxHeight: dimensions.height - 200 }} />
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={data.executing}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="h-3 w-3" />
        Execute Node
      </button>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize nodrag"
        onMouseDown={handleResizeStart}
        style={{ touchAction: "none" }}
      >
        <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-muted-foreground/30 rounded-br" />
      </div>

      <Handle type="source" position={Position.Right} className="!bg-pink-500" id="result-output" />
    </div>
  )
})

VideoNode.displayName = "VideoNode"
