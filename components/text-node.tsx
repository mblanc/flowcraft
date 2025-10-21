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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLocalText(data.text)
  }, [data.text])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [localText])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value)
  }

  const handleBlur = () => {
    updateNodeData(id, { text: localText })
  }

  return (
    <div
      className={`relative bg-card border-2 rounded-lg p-4 min-w-[220px] shadow-lg transition-all ${
        selected ? "border-primary shadow-primary/20" : "border-border"
      }`}
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
            className="w-full text-xs min-h-[28px] px-2 py-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 nodrag resize-none overflow-hidden"
          />
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-purple-500" />
    </div>
  )
})

TextNode.displayName = "TextNode"
