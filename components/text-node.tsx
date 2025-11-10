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

  // Prevent canvas zoom when scrolling inside textarea (works for mouse wheel and touchpad)
  useEffect(() => {
    const textarea = textareaRef.current
    const container = nodeRef.current
    if (!textarea || !container) return

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      const isTextareaFocused = document.activeElement === textarea
      const isInsideTextarea = target === textarea || textarea.contains(target)
      
      // If wheel event is on textarea, inside it, or textarea is focused, prevent canvas zoom
      if (isInsideTextarea || isTextareaFocused) {
        e.stopPropagation()
        e.stopImmediatePropagation()
        // Allow native scrolling behavior by not preventing default
        return false
      }
    }

    // Use capture phase to intercept before React Flow processes it
    // This catches events in the capture phase before they bubble up
    // Also handle at the textarea level with both capture and bubble phases
    const options = { capture: true, passive: false }
    container.addEventListener("wheel", handleWheel, options)
    textarea.addEventListener("wheel", handleWheel, options)
    // Also add non-capture listener for extra safety
    textarea.addEventListener("wheel", handleWheel, { passive: false })

    // Also handle focus/blur to track when textarea is active
    let focusedHandler: ((e: WheelEvent) => void) | null = null
    
    const handleFocus = () => {
      // Add a more aggressive wheel handler when focused
      focusedHandler = (e: WheelEvent) => {
        const target = e.target as HTMLElement
        // Only stop if event is on textarea or inside container
        if (target === textarea || textarea.contains(target) || container.contains(target)) {
          e.stopPropagation()
          e.stopImmediatePropagation()
        }
      }
      document.addEventListener("wheel", focusedHandler, { capture: true, passive: false })
    }

    const handleBlur = () => {
      if (focusedHandler) {
        document.removeEventListener("wheel", focusedHandler, { capture: true })
        focusedHandler = null
      }
    }

    textarea.addEventListener("focus", handleFocus)
    textarea.addEventListener("blur", handleBlur)

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true })
      textarea.removeEventListener("wheel", handleWheel, { capture: true })
      textarea.removeEventListener("wheel", handleWheel)
      textarea.removeEventListener("focus", handleFocus)
      textarea.removeEventListener("blur", handleBlur)
      if (focusedHandler) {
        document.removeEventListener("wheel", focusedHandler, { capture: true })
      }
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value)
  }

  const handleBlur = () => {
    updateNodeData(id, { text: localText })
  }

  const handleWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
    // Stop propagation to prevent canvas zoom when scrolling text
    e.stopPropagation()
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
          <div
            onWheel={(e) => {
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
            }}
            className="nodrag"
          >
            <Textarea
              ref={textareaRef}
              value={localText}
              onChange={handleTextChange}
              onBlur={handleBlur}
              onWheel={handleWheel}
              placeholder="Enter text..."
              className="w-full text-xs px-2 py-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 nodrag resize-none overflow-y-auto"
              style={{ height: dimensions.height - 80 }}
            />
          </div>
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
