import { Edge, Node } from "@xyflow/react"
import { NodeData, NodeType, NodeInputs } from "./types"
import { executeAgentNode, executeImageNode, executeUpscaleNode, executeVideoNode, executeResizeNode } from "./executors"

type NodeExecutor = (node: Node, inputs: NodeInputs) => Promise<Partial<NodeData>>

const executors: Record<NodeType, NodeExecutor | null> = {
    agent: executeAgentNode as unknown as NodeExecutor,
    image: executeImageNode as unknown as NodeExecutor,
    video: executeVideoNode as unknown as NodeExecutor,
    upscale: executeUpscaleNode as unknown as NodeExecutor,
    resize: executeResizeNode as unknown as NodeExecutor,
    text: null,
    file: null,
}

export class WorkflowEngine {
    private nodesMap: Map<string, Node<NodeData>>
    private edges: Edge[]
    private onNodeUpdate: (nodeId: string, data: Partial<NodeData>) => void
    private executionResults: Map<string, Partial<NodeData>> = new Map()

    constructor(
        nodes: Node<NodeData>[],
        edges: Edge[],
        onNodeUpdate: (nodeId: string, data: Partial<NodeData>) => void,
    ) {
        this.nodesMap = new Map(nodes.map((n) => [n.id, n]))
        this.edges = edges
        this.onNodeUpdate = onNodeUpdate
    }

    async run() {
        const levels = this.getExecutionLevels()

        for (const level of levels) {
            await Promise.all(
                level.map(async (nodeId) => {
                    const node = this.nodesMap.get(nodeId)
                    if (!node) return

                    const executor = executors[node.data.type]
                    if (!executor) return

                    try {
                        this.onNodeUpdate(nodeId, { executing: true })

                        const inputs = this.gatherInputs(node)
                        const result = await executor(node, inputs)

                        // Store result for dependent nodes
                        this.executionResults.set(nodeId, result)

                        // Update node with result
                        this.onNodeUpdate(nodeId, { ...result, executing: false })

                        // Update internal map state for next levels
                        const updatedNode = { ...node, data: { ...node.data, ...result } } as Node<NodeData>
                        this.nodesMap.set(nodeId, updatedNode)

                    } catch (error) {
                        console.error(`Error executing node ${nodeId}:`, error)
                        this.onNodeUpdate(nodeId, { executing: false })
                        // We might want to stop execution here or continue with other branches
                    }
                })
            )
        }
    }

    async executeNode(nodeId: string) {
        const node = this.nodesMap.get(nodeId)
        if (!node) return

        const executor = executors[node.data.type]
        if (!executor) return

        try {
            this.onNodeUpdate(nodeId, { executing: true })
            const inputs = this.gatherInputs(node)
            const result = await executor(node, inputs)

            this.executionResults.set(nodeId, result)
            this.onNodeUpdate(nodeId, { ...result, executing: false })

            const updatedNode = { ...node, data: { ...node.data, ...result } } as Node<NodeData>
            this.nodesMap.set(nodeId, updatedNode)
        } catch (error) {
            console.error(`Error executing node ${nodeId}:`, error)
            this.onNodeUpdate(nodeId, { executing: false })
        }
    }

    private getExecutionLevels(): string[][] {
        const nodes = Array.from(this.nodesMap.values())
        const dependents = new Map<string, Set<string>>()
        const dependencies = new Map<string, Set<string>>()

        nodes.forEach((node) => {
            dependents.set(node.id, new Set())
            dependencies.set(node.id, new Set())
        })

        this.edges.forEach((edge) => {
            dependents.get(edge.source)?.add(edge.target)
            dependencies.get(edge.target)?.add(edge.source)
        })

        const levels: string[][] = []
        const processed = new Set<string>()

        while (processed.size < nodes.length) {
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
                break // Break to avoid infinite loop if circular
            }

            levels.push(currentLevel)
            currentLevel.forEach((id) => processed.add(id))
        }

        return levels
    }

    private gatherInputs(node: Node<NodeData>): NodeInputs {
        const incomingEdges = this.edges.filter((edge) => edge.target === node.id)
        const inputs: NodeInputs = {}

        // Helper to get source node data (either from initial state or execution results)
        const getSourceData = (sourceId: string): NodeData | null => {
            const sourceNode = this.nodesMap.get(sourceId)
            const result = this.executionResults.get(sourceId)
            if (!sourceNode) return null

            return { ...sourceNode.data, ...result } as NodeData
        }

        if (node.data.type === "agent") {
            // Agent inputs
            const promptEdge = incomingEdges.find((edge) => edge.targetHandle === "prompt-input")
            if (promptEdge) {
                const sourceData = getSourceData(promptEdge.source)
                if (sourceData?.type === "text") inputs.prompt = sourceData.text
            }

            const fileEdges = incomingEdges.filter((edge) => edge.targetHandle === "file-input")
            inputs.files = []
            for (const edge of fileEdges) {
                const sourceData = getSourceData(edge.source)
                if (sourceData?.type === "file" && sourceData.gcsUri) {
                    inputs.files.push({ url: sourceData.gcsUri, type: sourceData.fileType || "image" })
                } else if (sourceData?.type === "resize" && sourceData.output) {
                    inputs.files.push({ url: sourceData.output, type: "image" })
                }
            }
        } else if (node.data.type === "image") {
            // Image inputs
            const promptEdge = incomingEdges.find((edge) => !edge.targetHandle || edge.targetHandle !== "image-input")
            if (promptEdge) {
                const sourceData = getSourceData(promptEdge.source)
                if (sourceData?.type === "text") inputs.prompt = sourceData.text
                else if (sourceData?.type === "agent") inputs.prompt = sourceData.output
            }

            const imageEdges = incomingEdges.filter((edge) => edge.targetHandle === "image-input")
            inputs.images = []
            for (const edge of imageEdges) {
                const sourceData = getSourceData(edge.source)
                if (sourceData?.type === "image" && sourceData.images) inputs.images.push(...sourceData.images)
                else if (sourceData?.type === "file" && sourceData.fileType === "image" && sourceData.gcsUri) inputs.images.push(sourceData.gcsUri)
                else if (sourceData?.type === "upscale" && sourceData.image) inputs.images.push(sourceData.image)
                else if (sourceData?.type === "resize" && sourceData.output) inputs.images.push(sourceData.output)
            }
        } else if (node.data.type === "video") {
            // Video inputs
            const promptEdge = incomingEdges.find((edge) => edge.targetHandle === "prompt-input")
            if (promptEdge) {
                const sourceData = getSourceData(promptEdge.source)
                if (sourceData?.type === "text") inputs.prompt = sourceData.text
                else if (sourceData?.type === "agent") inputs.prompt = sourceData.output
            }

            const firstFrameEdge = incomingEdges.find((edge) => edge.targetHandle === "first-frame-input")
            if (firstFrameEdge) {
                const sourceData = getSourceData(firstFrameEdge.source)
                if (sourceData?.type === "image" && sourceData.images?.[0]) inputs.firstFrame = sourceData.images[0]
                else if (sourceData?.type === "file" && sourceData.fileType === "image" && sourceData.gcsUri) inputs.firstFrame = sourceData.gcsUri
                else if (sourceData?.type === "upscale" && sourceData.image) inputs.firstFrame = sourceData.image
                else if (sourceData?.type === "resize" && sourceData.output) inputs.firstFrame = sourceData.output
            }

            const lastFrameEdge = incomingEdges.find((edge) => edge.targetHandle === "last-frame-input")
            if (lastFrameEdge) {
                const sourceData = getSourceData(lastFrameEdge.source)
                if (sourceData?.type === "image" && sourceData.images?.[0]) inputs.lastFrame = sourceData.images[0]
                else if (sourceData?.type === "file" && sourceData.fileType === "image" && sourceData.gcsUri) inputs.lastFrame = sourceData.gcsUri
                else if (sourceData?.type === "upscale" && sourceData.image) inputs.lastFrame = sourceData.image
                else if (sourceData?.type === "resize" && sourceData.output) inputs.lastFrame = sourceData.output
            }

            const imageEdges = incomingEdges.filter((edge) => edge.targetHandle === "image-input")
            inputs.images = []
            for (const edge of imageEdges) {
                const sourceData = getSourceData(edge.source)
                if (sourceData?.type === "image" && sourceData.images) inputs.images.push(...sourceData.images)
                else if (sourceData?.type === "file" && sourceData.fileType === "image" && sourceData.gcsUri) inputs.images.push(sourceData.gcsUri)
                else if (sourceData?.type === "upscale" && sourceData.image) inputs.images.push(sourceData.image)
                else if (sourceData?.type === "resize" && sourceData.output) inputs.images.push(sourceData.output)
            }
        } else if (node.data.type === "upscale") {
            // Upscale inputs
            const imageEdge = incomingEdges.find((edge) => edge.targetHandle === "image-input")
            if (imageEdge) {
                const sourceData = getSourceData(imageEdge.source)
                if (sourceData?.type === "image" && sourceData.images?.[0]) inputs.image = sourceData.images[0]
                else if (sourceData?.type === "file" && sourceData.fileType === "image" && sourceData.gcsUri) inputs.image = sourceData.gcsUri
                else if (sourceData?.type === "upscale" && sourceData.image) inputs.image = sourceData.image
                else if (sourceData?.type === "resize" && sourceData.output) inputs.image = sourceData.output
            }
        } else if (node.data.type === "resize") {
            // Resize inputs
            const imageEdge = incomingEdges.find((edge) => edge.targetHandle === "image-input")
            console.log("[WorkflowEngine] Resize Node Input Debug:", {
                nodeId: node.id,
                incomingEdges,
                imageEdge,
            })
            if (imageEdge) {
                const sourceData = getSourceData(imageEdge.source)
                console.log("[WorkflowEngine] Resize Node Source Data:", JSON.stringify(sourceData, null, 2))

                if (sourceData?.type === "image" && sourceData.images?.[0]) {
                    inputs.image = sourceData.images[0]
                } else if (sourceData?.type === "file") {
                    if (sourceData.fileType === "image" && sourceData.gcsUri) {
                        inputs.image = sourceData.gcsUri
                    } else {
                        console.warn("[WorkflowEngine] File Node source is not a valid image:", {
                            fileType: sourceData.fileType,
                            hasGcsUri: !!sourceData.gcsUri
                        })
                    }
                } else if (sourceData?.type === "upscale" && sourceData.image) {
                    inputs.image = sourceData.image
                } else if (sourceData?.type === "resize" && sourceData.output) {
                    inputs.image = sourceData.output
                }

                console.log("[WorkflowEngine] Resize Node Resolved Input:", inputs.image)
            } else {
                console.warn("[WorkflowEngine] No image edge found for resize node")
            }
        }

        return inputs
    }
}
