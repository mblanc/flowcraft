"use client"

import type React from "react"
import { memo, useRef, useEffect, useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { ResizeData } from "@/lib/types"
import { Play, Scaling } from "lucide-react"
import { useFlow } from "./flow-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const ResizeNode = memo(({ data, selected, id }: NodeProps<Node<ResizeData>>) => {
  const { executeNode, updateNodeData } = useFlow()
  const nodeRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({
    width: data.width || 400,
    height: data.height || 600,
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const [outputSignedUrl, setOutputSignedUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (data.width !== undefined && data.height !== undefined) {
      setDimensions({ width: data.width, height: data.height })
    }
  }, [data.width, data.height])

  useEffect(() => {
    if (data.output) {
      if (data.output.startsWith("gs://")) {
        fetch(`/api/signed-url?gcsUri=${encodeURIComponent(data.output)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.signedUrl) {
              setOutputSignedUrl(data.signedUrl)
            } else {
              console.error("Failed to get signed URL:", data.error)
              setOutputSignedUrl("/placeholder.svg")
            }
          })
          .catch((error) => {
            console.error("Error fetching signed URL:", error)
            setOutputSignedUrl("/placeholder.svg")
          })
      } else {
        setOutputSignedUrl(data.output)
      }
    } else {
      setOutputSignedUrl(undefined)
    }
  }, [data.output])

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation()
    executeNode(id)
  }

  const handleAspectRatioChange = (value: "16:9" | "9:16") => {
    updateNodeData(id, { aspectRatio: value })
  }

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

  return (
    <div
      ref={nodeRef}
      className={`bg-card border-2 rounded-lg p-4 shadow-lg transition-all relative ${selected ? "border-primary shadow-primary/20" : "border-border"
        } ${data.executing ? "animate-pulse-bg" : ""}`}
      style={{ width: dimensions.width }}
    >
      {/* Image Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image-input"
        className="!bg-green-500"
        style={{ top: "50%", left: -6 }}
      />
      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-5 whitespace-nowrap text-green-500 text-xs font-semibold">
        Input Image
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center">
          <Scaling className="h-5 w-5 text-blue-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{data.name}</h3>
          <div className="nodrag">
            <Select value={data.aspectRatio} onValueChange={handleAspectRatioChange}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Select Aspect Ratio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (1920x1080)</SelectItem>
                <SelectItem value="9:16">9:16 (1080x1920)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.executing && <span className="text-blue-400">Resizing...</span>}
          </div>
        </div>
      </div>

      {outputSignedUrl && (
        <div className="mt-3 rounded-md overflow-hidden border border-border" style={{ maxHeight: dimensions.height - 150 }}>
          <img
            src={outputSignedUrl}
            alt="Resized output"
            className="w-full h-auto object-contain"
            style={{ maxHeight: dimensions.height - 150 }}
          />
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={data.executing}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="h-3 w-3" />
        Resize
      </button>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize nodrag"
        onMouseDown={handleResizeStart}
        style={{ touchAction: "none" }}
      >
        <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-muted-foreground/30 rounded-br" />
      </div>

      <Handle type="source" position={Position.Right} className="!bg-green-500" id="output" />
    </div>
  )
})

ResizeNode.displayName = "ResizeNode"
