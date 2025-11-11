"use client"

import type React from "react"

import { memo, useRef, useEffect, useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { UpscaleData } from "./flow-provider"
import { ZoomIn, Play } from "lucide-react"
import { useFlow } from "./flow-provider"

export const UpscaleNode = memo(({ data, selected, id }: NodeProps<Node<UpscaleData>>) => {
  const { executeNode, updateNodeData } = useFlow()
  const nodeRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({
    width: data.width || 400,
    height: data.height || 600,
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const [imageSignedUrl, setImageSignedUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (data.width !== undefined && data.height !== undefined) {
      setDimensions({ width: data.width, height: data.height })
    }
  }, [data.width, data.height])

  useEffect(() => {
    if (data.image) {
      if (data.image.startsWith("gs://")) {
        fetch(`/api/signed-url?gcsUri=${encodeURIComponent(data.image)}`)
          .then((res) => res.json())
          .then((result) => {
            if (result.signedUrl) {
              setImageSignedUrl(result.signedUrl)
            } else {
              console.error("Failed to get signed URL:", result.error)
              setImageSignedUrl("/placeholder.svg")
            }
          })
          .catch((error) => {
            console.error("Error fetching signed URL:", error)
            setImageSignedUrl("/placeholder.svg")
          })
      } else {
        setImageSignedUrl(data.image)
      }
    } else {
      setImageSignedUrl("/placeholder.svg")
    }
  }, [data.image])

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation()
    executeNode(id)
  }

  const handleUpscaleFactorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { upscaleFactor: e.target.value as "x2" | "x3" | "x4" })
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
      className={`bg-card border-2 rounded-lg p-4 shadow-lg transition-all relative ${
        selected ? "border-primary shadow-primary/20" : "border-border"
      } ${data.executing ? "animate-pulse-bg" : ""}`}
      style={{ width: dimensions.width }}
    >
      {/* Image Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image-input"
        className="!bg-green-500"
        style={{ top: 35, left: -6 }}
      />
      <div className="absolute right-full top-[18px] mr-5 whitespace-nowrap text-green-500 text-xs font-semibold">
        Image
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-red-500/10 flex items-center justify-center">
          <ZoomIn className="h-5 w-5 text-red-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{data.name}</h3>
          <div className="mb-2">
            <label className="text-xs text-muted-foreground mb-1 block">Upscale Factor</label>
            <select
              value={data.upscaleFactor}
              onChange={handleUpscaleFactorChange}
              className="w-full text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary nodrag"
            >
              <option value="x2">2x</option>
              <option value="x3">3x</option>
              <option value="x4">4x</option>
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            {data.image ? "Upscaled Image" : "No image"}
            {data.executing && <span className="ml-2 text-red-400">Upscaling...</span>}
          </div>
        </div>
      </div>

      {data.image && imageSignedUrl && (
        <div className="mt-3 rounded-md overflow-hidden border border-border" style={{ maxHeight: dimensions.height - 200 }}>
          <img
            src={imageSignedUrl}
            alt={data.name}
            width={dimensions.width - 32}
            height={dimensions.height - 200}
            className="w-full h-auto object-contain"
            style={{ maxHeight: dimensions.height - 200 }}
          />
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={data.executing}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      <Handle type="source" position={Position.Right} className="!bg-green-500" id="result-output" />
    </div>
  )
})

UpscaleNode.displayName = "UpscaleNode"

