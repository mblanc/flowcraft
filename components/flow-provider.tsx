"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import {
  type Node,
  type Edge,
  type Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react"
import { AgentData, FileData, ImageData, NodeData, TextData, UpscaleData, VideoData, ResizeData } from "@/lib/types"
import { WorkflowEngine } from "@/lib/workflow-engine"

interface FlowContextType {
  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNode: Node<NodeData> | null
  isRunning: boolean
  flowId: string | null
  flowName: string
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addAgentNode: (position?: { x: number; y: number }) => void
  addTextNode: (position?: { x: number; y: number }) => void
  addImageNode: (position?: { x: number; y: number }) => void
  addVideoNode: (position?: { x: number; y: number }) => void
  addFileNode: (position?: { x: number; y: number }) => void
  addUpscaleNode: (position?: { x: number; y: number }) => void
  addResizeNode: (position?: { x: number; y: number }) => void
  selectNode: (nodeId: string | null) => void
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  updateFlowName: (name: string) => void
  runFlow: () => Promise<void>
  executeNode: (nodeId: string) => Promise<void>
  exportFlow: () => void
  importFlow: () => void
  loadFlow: (id: string, nodes: Node<NodeData>[], edges: Edge[], name: string) => void
  saveFlow: () => Promise<void>
}

const FlowContext = createContext<FlowContextType | null>(null)

export function useFlow() {
  const context = useContext(FlowContext)
  if (!context) {
    throw new Error("useFlow must be used within FlowProvider")
  }
  return context
}

export function FlowProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Node<NodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [flowId, setFlowId] = useState<string | null>(null)
  const [flowName, setFlowName] = useState<string>("Untitled Flow")
  // Removed autoSaveTimeout state
  // const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const saveFlow = useCallback(async (thumbnail?: string, nodesToSave?: Node<NodeData>[]) => {
    if (!flowId) return

    // Use provided nodes or fall back to current state
    const nodesToUse = nodesToSave || nodes

    let thumbnailToUse = thumbnail

    if (!thumbnailToUse) {
      const imageNodes = nodesToUse.filter((node) => {
        const data = node.data
        if (data.type === "image" && (data as ImageData).images?.length > 0) return true
        if (data.type === "upscale" && (data as UpscaleData).image) return true
        if (data.type === "resize" && (data as ResizeData).output) return true
        if (data.type === "video" && (data as VideoData).images?.length > 0) return true
        return false
      })

      if (imageNodes.length > 0) {
        imageNodes.sort((a, b) => {
          const timeA = a.data.generatedAt || 0
          const timeB = b.data.generatedAt || 0
          return timeB - timeA
        })

        const latestNode = imageNodes[0]
        const data = latestNode.data
        if (data.type === "image") thumbnailToUse = (data as ImageData).images[0]
        else if (data.type === "upscale") thumbnailToUse = (data as UpscaleData).image
        else if (data.type === "resize") thumbnailToUse = (data as ResizeData).output
        else if (data.type === "video") thumbnailToUse = (data as VideoData).images[0]
      }
    }

    try {
      await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: flowName,
          nodes: nodesToUse,
          edges,
          ...(thumbnailToUse !== undefined && { thumbnail: thumbnailToUse }),
        }),
      })
      console.log("[v0] Flow auto-saved")
    } catch (error) {
      console.error("[v0] Error saving flow:", error)
    }
  }, [flowId, flowName, nodes, edges])

  // const onNodesChange = useCallback(
  //   (changes: NodeChange[]) => {
  //     setNodes((nds) => applyNodeChanges(changes, nds) as Node<NodeData>[])

  //     // Auto-save after changes
  //     if (flowId) {
  //       if (autoSaveTimeout) {
  //         clearTimeout(autoSaveTimeout)
  //       }
  //       const timeout = setTimeout(() => {
  //         saveFlow()
  //       }, 2000)
  //       setAutoSaveTimeout(timeout)
  //     }
  //   },
  //   [flowId, autoSaveTimeout, saveFlow]
  // )

  // const onEdgesChange = useCallback(
  //   (changes: EdgeChange[]) => {
  //     setEdges((eds) => applyEdgeChanges(changes, eds))

  //     // Auto-save after changes
  //     if (flowId) {
  //       if (autoSaveTimeout) {
  //         clearTimeout(autoSaveTimeout)
  //       }
  //       const timeout = setTimeout(() => {
  //         saveFlow()
  //       }, 2000)
  //       setAutoSaveTimeout(timeout)
  //     }
  //   },
  //   [flowId, autoSaveTimeout, saveFlow]
  // )
  // Updated: Only applies changes, no side effects
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<NodeData>[])
    },
    []
  )

  // Updated: Only applies changes, no side effects
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds))
    },
    []
  )

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [])

  const addAgentNode = useCallback((position?: { x: number; y: number }) => {
    const newNode: Node<AgentData> = {
      id: `agent-${Date.now()}`,
      type: "agent",
      position: position || { x: 250, y: 250 },
      data: {
        type: "agent",
        name: "Agent",
        model: "gemini-2.5-flash",
        instructions: "",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addTextNode = useCallback((position?: { x: number; y: number }) => {
    const newNode: Node<TextData> = {
      id: `text-${Date.now()}`,
      type: "text",
      position: position || { x: 250, y: 250 },
      data: {
        type: "text",
        name: "Text",
        text: "",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addImageNode = useCallback((position?: { x: number; y: number }) => {
    const newNode: Node<ImageData> = {
      id: `image-${Date.now()}`,
      type: "image",
      position: position || { x: 250, y: 250 },
      data: {
        type: "image",
        name: "Image",
        prompt: "",
        images: [],
        aspectRatio: "16:9",
        model: "gemini-2.5-flash-image",
        resolution: "1K",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addVideoNode = useCallback((position?: { x: number; y: number }) => {
    const newNode: Node<VideoData> = {
      id: `video-${Date.now()}`,
      type: "video",
      position: position || { x: 250, y: 250 },
      data: {
        type: "video",
        name: "Video",
        prompt: "",
        images: [],
        aspectRatio: "16:9",
        duration: 4,
        model: "veo-3.1-fast-generate-preview",
        generateAudio: false,
        resolution: "720p",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addFileNode = useCallback((position?: { x: number; y: number }) => {
    const newNode: Node<FileData> = {
      id: `file-${Date.now()}`,
      type: "file",
      position: position || { x: 250, y: 250 },
      data: {
        type: "file",
        name: "File",
        fileType: null,
        fileUrl: "",
        fileName: "",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addUpscaleNode = useCallback((position?: { x: number; y: number }) => {
    const newNode: Node<UpscaleData> = {
      id: `upscale-${Date.now()}`,
      type: "upscale",
      position: position || { x: 250, y: 250 },
      data: {
        type: "upscale",
        name: "Upscale",
        image: "",
        upscaleFactor: "x2",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addResizeNode = useCallback((position?: { x: number; y: number }) => {
    const newNode: Node<ResizeData> = {
      id: `resize-${Date.now()}`,
      type: "resize",
      position: position || { x: 250, y: 250 },
      data: {
        type: "resize",
        name: "Resize",
        aspectRatio: "16:9",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const selectNode = useCallback(
    (nodeId: string | null) => {
      if (nodeId) {
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            selected: node.id === nodeId,
          })),
        )
        const node = nodes.find((n) => n.id === nodeId)
        setSelectedNode(node || null)
      } else {
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            selected: false,
          })),
        )
        setSelectedNode(null)
      }
    },
    [nodes],
  )

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<NodeData>) => {
      setNodes((nds) => nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } as NodeData } : node)) as Node<NodeData>[])
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, ...data } as NodeData } : null) as Node<NodeData> | null)
      }
    },
    [selectedNode],
  )

  const updateFlowName = useCallback((name: string) => {
    setFlowName(name)
  }, [])

  const runFlow = useCallback(async () => {
    setIsRunning(true)
    try {
      const engine = new WorkflowEngine(nodes, edges, updateNodeData)
      await engine.run()
    } catch (error) {
      console.error("Error running flow:", error)
    } finally {
      setIsRunning(false)
    }
  }, [nodes, edges, updateNodeData])

  const executeNode = useCallback(async (nodeId: string) => {
    try {
      const engine = new WorkflowEngine(nodes, edges, updateNodeData)
      await engine.executeNode(nodeId)
    } catch (error) {
      console.error("Error executing node:", error)
    }
  }, [nodes, edges, updateNodeData])

  const exportFlow = useCallback(() => {
    const flowData = {
      name: flowName,
      nodes,
      edges,
    }
    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${flowName.replace(/\s+/g, "-").toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [flowName, nodes, edges])

  const importFlow = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const flowData = JSON.parse(event.target?.result as string)
            if (flowData.nodes && flowData.edges) {
              setNodes(flowData.nodes)
              setEdges(flowData.edges)
              if (flowData.name) setFlowName(flowData.name)
            }
          } catch (error) {
            console.error("Error importing flow:", error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])

  const loadFlow = useCallback((id: string, newNodes: Node<NodeData>[], newEdges: Edge[], name: string) => {
    setFlowId(id)
    setNodes(newNodes)
    setEdges(newEdges)
    setFlowName(name)
  }, [])

  return (
    <FlowContext.Provider
      value={{
        nodes,
        edges,
        selectedNode,
        isRunning,
        flowId,
        flowName,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addAgentNode,
        addTextNode,
        addImageNode,
        addVideoNode,
        addFileNode,
        addUpscaleNode,
        addResizeNode,
        selectNode,
        updateNodeData,
        updateFlowName,
        runFlow,
        executeNode,
        exportFlow,
        importFlow,
        loadFlow,
        saveFlow,
      }}
    >
      {children}
    </FlowContext.Provider>
  )
}
