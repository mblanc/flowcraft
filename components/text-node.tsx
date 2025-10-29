"use client"

import type React from "react"

import { memo, useState, useEffect, useRef } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { TextData } from "./flow-provider"
import { FileText } from "lucide-react"
import { useFlow } from "./flow-provider"
import { Textarea } from "./ui/textarea"

export const TextNode = memo(({ data, selected, id }: NodeProps<Node<TextData>>) => {
  const { updateNodeData } = useFlow()
  const [localText, setLocalText] = useState(data.text)
  const [dimensions, setDimensions] = useState({
    width: data.width || 300,
    height: data.height || 150,
  })
  const [isResizing, setIsResizing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  useEffect(() => {
    setLocalText(data.text)
  }, [data.text])

  useEffect(() => {
    if (data.width !== undefined && data.height !== undefined) {
      setDimensions({ width: data.width, height: data.height })
    }
  }, [data.width, data.height])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value)
  }

  const handleBlur = () => {
    updateNodeData(id, { text: localText })
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
      const newHeight = Math.max(100, resizeStartRef.current.height + deltaY)
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
      className={`relative bg-card border-2 rounded-lg p-4 shadow-lg transition-all ${
        selected ? "border-primary shadow-primary/20" : "border-border"
      }`}
      style={{ width: dimensions.width }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-purple-500/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-purple-400" />
        </div>

        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{data.name}</h3>
          <Textarea
            ref={textareaRef}
            value={localText}
            onChange={handleTextChange}
            onBlur={handleBlur}
            placeholder="Enter text..."
            className="w-full text-xs px-2 py-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 nodrag resize-none overflow-y-auto"
            style={{ height: dimensions.height - 80 }}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize nodrag"
        onMouseDown={handleResizeStart}
        style={{ touchAction: "none" }}
      >
        <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-muted-foreground/30 rounded-br" />
      </div>

      <Handle type="source" position={Position.Right} className="!bg-purple-500" />
    </div>
  )
})

TextNode.displayName = "TextNode"
