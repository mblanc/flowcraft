"use client"

import type React from "react"

import { memo, useRef, useEffect, useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { AgentData } from "./flow-provider"
import { Bot, Play } from "lucide-react"
import { useFlow } from "./flow-provider"

export const AgentNode = memo(({ data, selected, id }: NodeProps<Node<AgentData>>) => {
  const { updateNodeData, executeNode } = useFlow()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localInstructions, setLocalInstructions] = useState(data.instructions)

  useEffect(() => {
    setLocalInstructions(data.instructions)
  }, [data.instructions])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [localInstructions])

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalInstructions(e.target.value)
  }

  const handleBlur = () => {
    updateNodeData(id, { instructions: localInstructions })
  }

  const handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation()
    executeNode(id)
  }

  return (
    <div
      className={`bg-card border-2 rounded-lg p-4 min-w-[220px] max-w-[220px] shadow-lg transition-all relative ${
        selected ? "border-primary shadow-primary/20" : "border-border"
      } ${data.executing ? "animate-pulse-bg" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="prompt-input"
        className="!bg-blue-500"
        style={{ top: 35, left: -6 }}
      />
      <div className="absolute right-full top-[18px] mr-5 whitespace-nowrap text-blue-500 text-xs font-semibold">
        Prompt
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="file-input"
        className="!bg-cyan-500"
        style={{ top: 65, left: -6 }}
      />
      <div className="absolute right-full top-[48px] mr-5 whitespace-nowrap text-cyan-500 text-xs font-semibold">
        File(s)
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{data.name}</h3>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-blue-400 font-mono">{data.model}</span>
          </div>
          <textarea
            ref={textareaRef}
            value={localInstructions}
            onChange={handleInstructionsChange}
            onBlur={handleBlur}
            placeholder="Enter instructions..."
            className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none resize-none overflow-hidden focus:text-foreground transition-colors nodrag mt-2"
            rows={1}
          />
          {data.executing && <div className="text-xs text-primary mt-2">Generating...</div>}
        </div>
      </div>

      {data.output && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Output:</div>
          <div className="text-xs text-foreground whitespace-pre-wrap break-words bg-muted/30 p-2 rounded-md max-h-[200px] overflow-y-auto">
            {data.output}
          </div>
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={data.executing}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="h-3 w-3" />
        Execute Node
      </button>

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  )
})

AgentNode.displayName = "AgentNode"
