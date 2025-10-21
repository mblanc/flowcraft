"use client"

import { useFlow } from "./flow-provider"
import { ConfigPanel } from "./config-panel"
import { X, Bot, FileText, ImageIcon, Video, FileUp } from "lucide-react"
import { Button } from "./ui/button"

export function Sidebar() {
  const { selectedNode, selectNode } = useFlow()

  if (!selectedNode) {
    return null
  }

  const getNodeTypeInfo = () => {
    switch (selectedNode.data.type) {
      case "agent":
        return { title: "Agent Configuration", icon: Bot, color: "text-primary" }
      case "text":
        return { title: "Text Configuration", icon: FileText, color: "text-purple-400" }
      case "image":
        return { title: "Image Configuration", icon: ImageIcon, color: "text-orange-400" }
      case "video":
        return { title: "Video Configuration", icon: Video, color: "text-pink-400" }
      case "file":
        return { title: "File Configuration", icon: FileUp, color: "text-cyan-400" }
      default:
        return { title: "Configuration", icon: Bot, color: "text-primary" }
    }
  }

  const { title, icon: Icon, color } = getNodeTypeInfo()

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <h2 className="font-semibold text-foreground">{title}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => selectNode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ConfigPanel />
      </div>
    </div>
  )
}
