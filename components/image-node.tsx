"use client"

import type React from "react"

import { memo, useRef, useEffect, useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { ImageData } from "@/lib/types"
import { ImageIcon, Play } from "lucide-react"
import { useFlow } from "./flow-provider"

export const ImageNode = memo(({ data, selected, id }: NodeProps<Node<ImageData>>) => {
  const { executeNode, updateNodeData } = useFlow()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)
  const [localPrompt, setLocalPrompt] = useState(data.prompt)
  const [dimensions, setDimensions] = useState({
    width: data.width || 400,
    height: data.height || 600,
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const [imageSignedUrl, setImageSignedUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    setLocalPrompt(data.prompt)
  }, [data.prompt])

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

    const handleTextareaFocus = () => {
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

    const handleTextareaBlur = () => {
      if (focusedHandler) {
        document.removeEventListener("wheel", focusedHandler, { capture: true })
        focusedHandler = null
      }
    }

    textarea.addEventListener("focus", handleTextareaFocus)
    textarea.addEventListener("blur", handleTextareaBlur)

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true })
      textarea.removeEventListener("wheel", handleWheel, { capture: true })
      textarea.removeEventListener("wheel", handleWheel)
      textarea.removeEventListener("focus", handleTextareaFocus)
      textarea.removeEventListener("blur", handleTextareaBlur)
      if (focusedHandler) {
        document.removeEventListener("wheel", focusedHandler, { capture: true })
      }
    }
  }, [])

  useEffect(() => {
    if (data.images && data.images.length > 0) {
      const imageSource = data.images[0]
      if (imageSource.startsWith("gs://")) {
        fetch(`/api/signed-url?gcsUri=${encodeURIComponent(imageSource)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.signedUrl) {
              setImageSignedUrl(data.signedUrl)
            } else {
              console.error("Failed to get signed URL:", data.error)
              setImageSignedUrl("/placeholder.svg")
            }
          })
          .catch((error) => {
            console.error("Error fetching signed URL:", error)
            setImageSignedUrl("/placeholder.svg")
          })
      } else {
        console.log("Image source:", imageSource)
        setImageSignedUrl(imageSource)
      }
    } else {
      setImageSignedUrl("/placeholder.svg")
    }
  }, [data.images])

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const adjustHeight = () => {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const maxHeight = 200
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }

    adjustHeight()
  }, [localPrompt])

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation()
    executeNode(id)
  }

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalPrompt(e.target.value)
    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const maxHeight = 200
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
  }

  const handleBlur = () => {
    updateNodeData(id, { prompt: localPrompt })
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

      {/* Image Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image-input"
        className="!bg-green-500"
        style={{ top: 65, left: -6 }}
      />
      <div className="absolute right-full top-[48px] mr-5 whitespace-nowrap text-green-500 text-xs font-semibold">
        Image(s)
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-orange-500/10 flex items-center justify-center">
          <ImageIcon className="h-5 w-5 text-orange-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{data.name}</h3>
          <div
            onWheel={(e) => {
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
            }}
            className="nodrag"
          >
            <textarea
              ref={textareaRef}
              value={localPrompt}
              onChange={handlePromptChange}
              onBlur={handleBlur}
              onWheel={handleWheel}
              placeholder="Enter prompt..."
              className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none resize-none overflow-y-auto focus:text-foreground transition-colors nodrag mb-2"
              style={{ minHeight: '1.5em', maxHeight: 200 }}
              rows={1}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Image {data.images.length > 0 && `(${data.images.length})`}
            {data.executing && <span className="ml-2 text-orange-400">Generating...</span>}
          </div>
        </div>
      </div>

      {data.images.length > 0 && imageSignedUrl && (
        <div className="mt-3 rounded-md overflow-hidden border border-border" style={{ maxHeight: dimensions.height - 200 }}>
          <img
            src={imageSignedUrl}
            alt={data.name}
            className="w-full h-auto object-contain"
            style={{ maxHeight: dimensions.height - 200 }}
          />
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={data.executing}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

ImageNode.displayName = "ImageNode"
