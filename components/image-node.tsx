"use client"

import type React from "react"

import { memo, useRef, useEffect, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { ImageData } from "./flow-provider"
import { ImageIcon, Play } from "lucide-react"
import { useFlow } from "./flow-provider"

export const ImageNode = memo(({ data, selected, id }: NodeProps<ImageData>) => {
  const { executeNode, updateNodeData } = useFlow()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localPrompt, setLocalPrompt] = useState(data.prompt)

  useEffect(() => {
    setLocalPrompt(data.prompt)
  }, [data.prompt])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [localPrompt])

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
      className={`bg-card border-2 rounded-lg p-4 min-w-[220px] shadow-lg transition-all relative ${
        selected ? "border-primary shadow-primary/20" : "border-border"
      } ${data.executing ? "animate-pulse-bg" : ""}`}
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
          <textarea
            ref={textareaRef}
            value={localPrompt}
            onChange={handlePromptChange}
            onBlur={handleBlur}
            placeholder="Enter prompt..."
            className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none resize-none overflow-hidden focus:text-foreground transition-colors nodrag mb-2"
            rows={1}
          />
          <div className="text-xs text-muted-foreground">
            Image {data.images.length > 0 && `(${data.images.length})`}
            {data.executing && <span className="ml-2 text-orange-400">Generating...</span>}
          </div>
        </div>
      </div>

      {data.images.length > 0 && (
        <div className="mt-3 rounded-md overflow-hidden border border-border">
          <img
            src={data.images[0] || "/placeholder.svg"}
            alt={data.name}
            className="w-full h-auto object-contain max-h-[300px]"
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

      <Handle type="source" position={Position.Right} className="!bg-green-500" id="result-output" />
    </div>
  )
})

ImageNode.displayName = "ImageNode"
