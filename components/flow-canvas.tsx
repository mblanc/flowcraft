"use client"

import type React from "react"

import { useCallback } from "react"
import { ReactFlow, Controls, Panel, type Node } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { NodeData, useFlow } from "./flow-provider"
import { AgentNode } from "./agent-node"
import { TextNode } from "./text-node"
import { ImageNode } from "./image-node"
import { VideoNode } from "./video-node"
import { FileNode } from "./file-node"
import { UpscaleNode } from "./upscale-node"
import { Button } from "./ui/button"
import { Bot, FileText, ImageIcon, Video, Play, FileUp, ZoomIn } from "lucide-react"

const nodeTypes = {
  agent: AgentNode,
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  file: FileNode,
  upscale: UpscaleNode,
}

export function FlowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addAgentNode,
    addTextNode,
    addImageNode,
    addVideoNode,
    addFileNode,
    addUpscaleNode,
    selectNode,
    runFlow,
    isRunning,
  } = useFlow()

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  return (
    <div className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        minZoom={0.1}
        maxZoom={2}
        className="react-flow"
        style={{ backgroundColor: "#e7e7e7" }}
      >
        <Controls />
        <Panel position="top-left" className="bg-card border border-border rounded-lg p-2 flex gap-2">
          <Button onClick={addTextNode} size="sm" className="bg-purple-500 text-white hover:bg-purple-600">
            <FileText className="h-4 w-4 mr-2" />
            Text
          </Button>
          <Button onClick={addFileNode} size="sm" className="bg-cyan-500 text-white hover:bg-cyan-600">
            <FileUp className="h-4 w-4 mr-2" />
            File
          </Button>
          <Button onClick={addAgentNode} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Bot className="h-4 w-4 mr-2" />
            Agent
          </Button>
          <Button onClick={addImageNode} size="sm" className="bg-orange-500 text-white hover:bg-orange-600">
            <ImageIcon className="h-4 w-4 mr-2" />
            Image
          </Button>
          <Button onClick={addVideoNode} size="sm" className="bg-pink-500 text-white hover:bg-pink-600">
            <Video className="h-4 w-4 mr-2" />
            Video
          </Button>
          <Button onClick={addUpscaleNode} size="sm" className="bg-red-500 text-white hover:bg-red-600">
            <ZoomIn className="h-4 w-4 mr-2" />
            Upscale
          </Button>
        </Panel>
        <Panel position="top-right" className="bg-card border border-border rounded-lg p-2">
          <Button
            onClick={runFlow}
            disabled={isRunning}
            size="sm"
            className="bg-green-500 text-white hover:bg-green-600"
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? "Running..." : "Run Flow"}
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
