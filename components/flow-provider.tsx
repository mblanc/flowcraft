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

export type NodeType = "agent" | "text" | "image" | "video" | "file"

export interface AgentData extends Record<string, unknown> {
  type: "agent"
  name: string
  model: string
  instructions: string
  output?: string
  executing?: boolean
}

export interface TextData extends Record<string, unknown> {
  type: "text"
  name: string
  text: string
  executing?: boolean
}

export interface ImageData extends Record<string, unknown> {
  type: "image"
  name: string
  prompt: string
  images: string[]
  aspectRatio: "16:9" | "9:16"
  model:
    | "gemini-2.5-flash-image"
    | "imagen-4.0-generate-001"
    | "imagen-4.0-fast-generate-001"
    | "imagen-4.0-ultra-generate-001"
  resolution: "1K" | "2K"
  executing?: boolean
}

export interface VideoData extends Record<string, unknown> {
  type: "video"
  name: string
  prompt: string
  images: string[]
  firstFrame?: string
  lastFrame?: string
  videoUrl?: string
  aspectRatio: "16:9" | "9:16"
  duration: 4 | 6 | 8
  model: "veo-3.1-fast-generate-preview" | "veo-3.1-generate-preview"
  generateAudio: boolean
  resolution: "720p" | "1080p"
  executing?: boolean
}

export interface FileData extends Record<string, unknown> {
  type: "file"
  name: string
  fileType: "image" | "video" | null
  fileUrl: string
  fileName: string
  executing?: boolean
}

export type NodeData = AgentData | TextData | ImageData | VideoData | FileData

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
  addAgentNode: () => void
  addTextNode: () => void
  addImageNode: () => void
  addVideoNode: () => void
  addFileNode: () => void
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
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const saveFlow = useCallback(async () => {
    if (!flowId) return

    try {
      await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: flowName,
          nodes,
          edges,
        }),
      })
      console.log("[v0] Flow auto-saved")
    } catch (error) {
      console.error("[v0] Error saving flow:", error)
    }
  }, [flowId, flowName, nodes, edges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<NodeData>[])
      
      // Auto-save after changes
      if (flowId) {
        if (autoSaveTimeout) {
          clearTimeout(autoSaveTimeout)
        }
        const timeout = setTimeout(() => {
          saveFlow()
        }, 2000)
        setAutoSaveTimeout(timeout)
      }
    },
    [flowId, autoSaveTimeout, saveFlow]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds))
      
      // Auto-save after changes
      if (flowId) {
        if (autoSaveTimeout) {
          clearTimeout(autoSaveTimeout)
        }
        const timeout = setTimeout(() => {
          saveFlow()
        }, 2000)
        setAutoSaveTimeout(timeout)
      }
    },
    [flowId, autoSaveTimeout, saveFlow]
  )

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [])

  const addAgentNode = useCallback(() => {
    const newNode: Node<AgentData> = {
      id: `agent-${Date.now()}`,
      type: "agent",
      position: { x: 250, y: 250 },
      data: {
        type: "agent",
        name: "Agent",
        model: "gemini-2.5-flash",
        instructions: "",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addTextNode = useCallback(() => {
    const newNode: Node<TextData> = {
      id: `text-${Date.now()}`,
      type: "text",
      position: { x: 250, y: 250 },
      data: {
        type: "text",
        name: "Text",
        text: "",
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  const addImageNode = useCallback(() => {
    const newNode: Node<ImageData> = {
      id: `image-${Date.now()}`,
      type: "image",
      position: { x: 250, y: 250 },
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

  const addVideoNode = useCallback(() => {
    const newNode: Node<VideoData> = {
      id: `video-${Date.now()}`,
      type: "video",
      position: { x: 250, y: 250 },
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

  const addFileNode = useCallback(() => {
    const newNode: Node<FileData> = {
      id: `file-${Date.now()}`,
      type: "file",
      position: { x: 250, y: 250 },
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

  const getExecutionLevels = useCallback((nodes: Node<NodeData>[], edges: Edge[]) => {
    // Build adjacency list (node -> nodes that depend on it)
    const dependents = new Map<string, Set<string>>()
    const dependencies = new Map<string, Set<string>>()

    nodes.forEach((node) => {
      dependents.set(node.id, new Set())
      dependencies.set(node.id, new Set())
    })

    edges.forEach((edge) => {
      dependents.get(edge.source)?.add(edge.target)
      dependencies.get(edge.target)?.add(edge.source)
    })

    // Group nodes into levels for parallel execution
    const levels: string[][] = []
    const processed = new Set<string>()

    while (processed.size < nodes.length) {
      // Find nodes with no unprocessed dependencies
      const currentLevel = nodes
        .filter((node) => !processed.has(node.id))
        .filter((node) => {
          const deps = dependencies.get(node.id)
          return !deps || Array.from(deps).every((dep) => processed.has(dep))
        })
        .map((node) => node.id)

      if (currentLevel.length === 0) {
        // Circular dependency or isolated nodes
        const remaining = nodes.filter((node) => !processed.has(node.id))
        if (remaining.length > 0) {
          currentLevel.push(...remaining.map((n) => n.id))
        }
      }

      levels.push(currentLevel)
      currentLevel.forEach((id) => processed.add(id))
    }

    return levels
  }, [])

  const executeImageNode = useCallback(
    async (
      node: Node<ImageData>,
      generatedImages: Map<string, string[]>,
      updatedNodeData: Map<string, Partial<NodeData>>,
    ) => {
      console.log("[v0] Processing image node:", node.id)

      updateNodeData(node.id, { executing: true })

      try {
        const incomingEdges = edges.filter((edge) => edge.target === node.id)

        if (incomingEdges.length === 0) {
          console.log("[v0] No incoming connections for image node:", node.id)
          updateNodeData(node.id, { executing: false })
          return
        }

        const promptEdge = incomingEdges.find((edge) => !edge.targetHandle || edge.targetHandle !== "image-input")
        const imageEdges = incomingEdges.filter((edge) => edge.targetHandle === "image-input")

        let prompt = ""
        if (promptEdge) {
          const sourceNode = nodes.find((n) => n.id === promptEdge.source)
          if (sourceNode) {
            const updatedData = updatedNodeData.get(sourceNode.id)

            if (sourceNode.data.type === "text") {
              prompt = sourceNode.data.text
            } else if (sourceNode.data.type === "agent") {
              prompt = (updatedData as AgentData)?.output || sourceNode.data.output || ""
              console.log("[v0] Using agent output for image prompt:", prompt.substring(0, 100))
            }
          }
        } else {
          prompt = node.data.prompt
        }

        const inputImages: string[] = []
        for (const imageEdge of imageEdges) {
          const sourceNode = nodes.find((n) => n.id === imageEdge.source)
          if (!sourceNode) continue

          if (sourceNode.data.type === "image") {
            const generated = generatedImages.get(sourceNode.id)
            if (generated && generated.length > 0) {
              console.log("[v0] Using generated image from node:", sourceNode.id)
              inputImages.push(...generated)
            } else if (sourceNode.data.images.length > 0) {
              console.log("[v0] Using stored image from node:", sourceNode.id)
              inputImages.push(...sourceNode.data.images)
            }
          } else if (sourceNode.data.type === "file") {
            if (sourceNode.data.fileUrl && sourceNode.data.fileType === "image") {
              console.log("[v0] Using file from File node:", sourceNode.id)
              inputImages.push(sourceNode.data.fileUrl)
            }
          }
        }

        if (!prompt) {
          console.log("[v0] No prompt available for image node:", node.id)
          updateNodeData(node.id, { executing: false })
          return
        }

        console.log("[v0] Generating image with prompt:", prompt)
        console.log("[v0] Input images:", inputImages.length)

        console.log("[v0] About to call /api/generate-image")

        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            images: inputImages,
            aspectRatio: node.data.aspectRatio,
            model: node.data.model,
            resolution: node.data.resolution,
          }),
        })

        console.log("[v0] Fetch completed, status:", response.status, response.statusText)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] Failed to generate image. Status:", response.status, "Error:", errorText)
          updateNodeData(node.id, { executing: false })
          return
        }

        const data = await response.json()
        console.log("[v0] Image generated successfully")

        generatedImages.set(node.id, [data.imageUrl])

        updateNodeData(node.id, {
          images: [data.imageUrl],
          executing: false,
        })
      } catch (error) {
        console.error("[v0] Error processing node:", node.id)
        console.error("[v0] Error details:", error)
        console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))
        console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
        updateNodeData(node.id, { executing: false })
      }
    },
    [nodes, edges, updateNodeData],
  )

  const executeAgentNode = useCallback(
    async (node: Node<AgentData>, updatedNodeData: Map<string, Partial<NodeData>>) => {
      console.log("[v0] Processing agent node:", node.id)

      updateNodeData(node.id, { executing: true })

      try {
        const incomingEdges = edges.filter((edge) => edge.target === node.id)

        let prompt = node.data.instructions
        const promptEdge = incomingEdges.find((edge) => edge.targetHandle === "prompt-input")
        if (promptEdge) {
          const sourceNode = nodes.find((n) => n.id === promptEdge.source)
          if (sourceNode && sourceNode.data.type === "text") {
            prompt = sourceNode.data.text
          }
        }

        const fileEdges = incomingEdges.filter((edge) => edge.targetHandle === "file-input")
        const files: Array<{ url: string; type: string }> = []
        for (const fileEdge of fileEdges) {
          const sourceNode = nodes.find((n) => n.id === fileEdge.source)
          if (sourceNode && sourceNode.data.type === "file" && sourceNode.data.fileUrl) {
            files.push({
              url: sourceNode.data.fileUrl,
              type: sourceNode.data.fileType || "image",
            })
          }
        }

        if (!prompt) {
          console.log("[v0] No prompt available for agent node:", node.id)
          updateNodeData(node.id, { executing: false })
          return
        }

        console.log("[v0] Generating text with prompt:", prompt)
        console.log("[v0] Input files:", files.length)

        console.log("[v0] About to call /api/generate-text")

        const response = await fetch("/api/generate-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            files,
            model: node.data.model,
          }),
        })

        console.log("[v0] Fetch completed, status:", response.status, response.statusText)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] Failed to generate text. Status:", response.status, "Error:", errorText)
          updateNodeData(node.id, { executing: false })
          return
        }

        const data = await response.json()
        console.log("[v0] Text generated successfully")

        updatedNodeData.set(node.id, { output: data.text })
        console.log("[v0] Stored agent output in updatedNodeData map")

        updateNodeData(node.id, {
          output: data.text,
          executing: false,
        })
      } catch (error) {
        console.error("[v0] Error processing agent node:", node.id)
        console.error("[v0] Error details:", error)
        console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))
        console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
        updateNodeData(node.id, { executing: false })
      }
    },
    [nodes, edges, updateNodeData],
  )

  const executeVideoNode = useCallback(
    async (
      node: Node<VideoData>,
      generatedImages: Map<string, string[]>,
      updatedNodeData: Map<string, Partial<NodeData>>,
    ) => {
      console.log("[v0] Processing video node:", node.id)

      updateNodeData(node.id, { executing: true })

      try {
        const incomingEdges = edges.filter((edge) => edge.target === node.id)

        if (incomingEdges.length === 0) {
          console.log("[v0] No incoming connections for video node:", node.id)
          updateNodeData(node.id, { executing: false })
          return
        }

        // Get prompt
        const promptEdge = incomingEdges.find((edge) => edge.targetHandle === "prompt-input")
        let prompt = node.data.prompt
        if (promptEdge) {
          const sourceNode = nodes.find((n) => n.id === promptEdge.source)
          if (sourceNode) {
            const updatedData = updatedNodeData.get(sourceNode.id)

            if (sourceNode.data.type === "text") {
              prompt = sourceNode.data.text
            } else if (sourceNode.data.type === "agent") {
              prompt = (updatedData as AgentData)?.output || sourceNode.data.output || ""
            }
          }
        }

        // Get first frame
        const firstFrameEdge = incomingEdges.find((edge) => edge.targetHandle === "first-frame-input")
        let firstFrame = ""
        if (firstFrameEdge) {
          const sourceNode = nodes.find((n) => n.id === firstFrameEdge.source)
          if (sourceNode) {
            if (sourceNode.data.type === "image" && sourceNode.data.images.length > 0) {
              firstFrame = sourceNode.data.images[0]
            } else if (sourceNode.data.type === "file" && sourceNode.data.fileType === "image") {
              firstFrame = sourceNode.data.fileUrl
            }
          }
        }

        // Get last frame
        const lastFrameEdge = incomingEdges.find((edge) => edge.targetHandle === "last-frame-input")
        let lastFrame = ""
        if (lastFrameEdge) {
          const sourceNode = nodes.find((n) => n.id === lastFrameEdge.source)
          if (sourceNode) {
            if (sourceNode.data.type === "image" && sourceNode.data.images.length > 0) {
              lastFrame = sourceNode.data.images[0]
            } else if (sourceNode.data.type === "file" && sourceNode.data.fileType === "image") {
              lastFrame = sourceNode.data.fileUrl
            }
          }
        }

        // Get reference images
        const imageEdges = incomingEdges.filter((edge) => edge.targetHandle === "image-input")
        const inputImages: string[] = []
        for (const imageEdge of imageEdges) {
          const sourceNode = nodes.find((n) => n.id === imageEdge.source)
          if (!sourceNode) continue

          if (sourceNode.data.type === "image") {
            const generated = generatedImages.get(sourceNode.id)
            if (generated && generated.length > 0) {
              inputImages.push(...generated)
            } else if (sourceNode.data.images.length > 0) {
              inputImages.push(...sourceNode.data.images)
            }
          } else if (sourceNode.data.type === "file" && sourceNode.data.fileType === "image") {
            inputImages.push(sourceNode.data.fileUrl)
          }
        }

        if (!prompt) {
          console.log("[v0] No prompt available for video node:", node.id)
          updateNodeData(node.id, { executing: false })
          return
        }

        console.log("[v0] Generating video with prompt:", prompt)
        console.log("[v0] First frame:", firstFrame ? "Yes" : "No")
        console.log("[v0] Last frame:", lastFrame ? "Yes" : "No")
        console.log("[v0] Reference images:", inputImages.length)

        const response = await fetch("/api/generate-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            firstFrame,
            lastFrame,
            images: inputImages,
            aspectRatio: node.data.aspectRatio,
            duration: node.data.duration,
            model: node.data.model,
            generateAudio: node.data.generateAudio,
            resolution: node.data.resolution,
          }),
        })

        console.log("[v0] Fetch completed, status:", response.status, response.statusText)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] Failed to generate video. Status:", response.status, "Error:", errorText)
          updateNodeData(node.id, { executing: false })
          return
        }

        const data = await response.json()
        console.log("[v0] Video generated successfully")

        updateNodeData(node.id, {
          videoUrl: data.videoUrl,
          firstFrame,
          lastFrame,
          executing: false,
        })
      } catch (error) {
        console.error("[v0] Error processing video node:", node.id)
        console.error("[v0] Error details:", error)
        console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))
        console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
        updateNodeData(node.id, { executing: false })
      }
    },
    [nodes, edges, updateNodeData],
  )

  const executeNode = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) {
        console.error("[v0] Node not found:", nodeId)
        return
      }

      console.log("[v0] Executing single node:", nodeId)

      const generatedImages = new Map<string, string[]>()
      const updatedNodeData = new Map<string, Partial<NodeData>>()

      if (node.data.type === "image") {
        await executeImageNode(node as Node<ImageData>, generatedImages, updatedNodeData)
      } else if (node.data.type === "agent") {
        await executeAgentNode(node as Node<AgentData>, updatedNodeData)
      } else if (node.data.type === "video") {
        await executeVideoNode(node as Node<VideoData>, generatedImages, updatedNodeData)
      }
    },
    [nodes, executeImageNode, executeVideoNode, executeAgentNode],
  )

  const runFlow = useCallback(async () => {
    setIsRunning(true)
    console.log("[v0] Starting flow execution")

    const generatedImages = new Map<string, string[]>()
    const updatedNodeData = new Map<string, Partial<NodeData>>()
    const executionLevels = getExecutionLevels(nodes, edges)

    console.log("[v0] Execution levels:", executionLevels)

    try {
      for (const level of executionLevels) {
        const levelPromises = level.map(async (nodeId) => {
          const node = nodes.find((n) => n.id === nodeId)
          if (!node) return

          if (node.data.type === "image") {
            await executeImageNode(node as Node<ImageData>, generatedImages, updatedNodeData)
          } else if (node.data.type === "agent") {
            await executeAgentNode(node as Node<AgentData>, updatedNodeData)
          } else if (node.data.type === "video") {
            await executeVideoNode(node as Node<VideoData>, generatedImages, updatedNodeData)
          }
        })

        await Promise.all(levelPromises)
      }
    } catch (error) {
      console.error("[v0] Error running flow:", error)
    } finally {
      setIsRunning(false)
      console.log("[v0] Flow execution completed")
    }
  }, [nodes, edges, getExecutionLevels, executeImageNode, executeVideoNode, executeAgentNode])

  const exportFlow = useCallback(() => {
    const flowData = {
      nodes,
      edges,
      version: "1.0",
      exportedAt: new Date().toISOString(),
    }

    const dataStr = JSON.stringify(flowData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement("a")
    link.href = url
    link.download = `flow-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log("[v0] Flow exported successfully")
  }, [nodes, edges])

  const importFlow = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const flowData = JSON.parse(event.target?.result as string)

          if (flowData.nodes && flowData.edges) {
            setNodes(flowData.nodes)
            setEdges(flowData.edges)
            setSelectedNode(null)
            console.log("[v0] Flow imported successfully")
          } else {
            console.error("[v0] Invalid flow file format")
          }
        } catch (error) {
          console.error("[v0] Error parsing flow file:", error)
        }
      }
      reader.readAsText(file)
    }

    input.click()
  }, [])

  const loadFlow = useCallback((id: string, flowNodes: Node<NodeData>[], flowEdges: Edge[], name: string) => {
    setFlowId(id)
    setFlowName(name)
    setNodes(flowNodes)
    setEdges(flowEdges)
    setSelectedNode(null)
    console.log("[v0] Flow loaded:", id)
  }, [])

  const updateFlowName = useCallback((name: string) => {
    setFlowName(name)
    // Auto-save after name change
    if (flowId) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }
      const timeout = setTimeout(() => {
        saveFlow()
      }, 2000)
      setAutoSaveTimeout(timeout)
    }
  }, [flowId, autoSaveTimeout, saveFlow])

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
