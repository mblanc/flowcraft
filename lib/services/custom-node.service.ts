import {
    getFirestore,
    CustomNodeDocument,
    CustomNodePort,
} from "@/lib/firestore";
import {
    CustomNodeCreateRequest,
    CustomNodeUpdateRequest,
} from "@/lib/schemas";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import {
    detectCycle,
    detectRecursiveCycle,
    GraphNode,
    GraphEdge,
} from "@/lib/graph-utils";
import {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";

interface NodeWithData extends GraphNode {
    type: string;
    data?: {
        type?: string;
        portName?: string;
        portType?: string;
        subWorkflowId?: string;
    };
}

export class CustomNodeService {
    private firestore = getFirestore();

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): CustomNodeDocument {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data?.userId as string,
            name: data?.name as string,
            nodes: data?.nodes as unknown[],
            edges: data?.edges as unknown[],
            thumbnail: data?.thumbnail as string | undefined,
            version: data?.version as number,
            inputs: data?.inputs as CustomNodePort[],
            outputs: data?.outputs as CustomNodePort[],
            createdAt:
                (data?.createdAt as { toDate?: () => Date })?.toDate?.() ||
                (data?.createdAt as Date),
            updatedAt:
                (data?.updatedAt as { toDate?: () => Date })?.toDate?.() ||
                (data?.updatedAt as Date),
        };
    }

    private extractInterface(nodes: NodeWithData[]): {
        inputs: CustomNodePort[];
        outputs: CustomNodePort[];
    } {
        const inputs: CustomNodePort[] = [];
        const outputs: CustomNodePort[] = [];

        for (const node of nodes) {
            const nodeType = node.type || node.data?.type;
            if (nodeType === "workflow-input") {
                inputs.push({
                    id: node.id,
                    name: node.data?.portName || "input",
                    type: node.data?.portType || "string",
                });
            } else if (nodeType === "workflow-output") {
                outputs.push({
                    id: node.id,
                    name: node.data?.portName || "output",
                    type: node.data?.portType || "string",
                });
            }
        }

        return { inputs, outputs };
    }

    async listCustomNodes(userId: string): Promise<CustomNodeDocument[]> {
        logger.debug(
            `[CustomNodeService] Listing custom nodes for user: ${userId}`,
        );
        const nodesRef = this.firestore.collection(COLLECTIONS.CUSTOM_NODES);
        const userNodes = await nodesRef
            .where("userId", "==", userId)
            .orderBy("updatedAt", "desc")
            .get();

        return userNodes.docs.map((doc) => this.transformDoc(doc));
    }

    async getCustomNode(
        nodeId: string,
        userId: string,
    ): Promise<CustomNodeDocument> {
        logger.debug(
            `[CustomNodeService] Getting custom node: ${nodeId} for user: ${userId}`,
        );
        const nodeDoc = await this.firestore
            .collection(COLLECTIONS.CUSTOM_NODES)
            .doc(nodeId)
            .get();

        if (!nodeDoc.exists) {
            throw new Error("Custom node not found");
        }

        const nodeData = this.transformDoc(nodeDoc);

        if (nodeData.userId !== userId) {
            throw new Error("Unauthorized");
        }

        return nodeData;
    }

    async createCustomNode(
        userId: string,
        data: CustomNodeCreateRequest,
    ): Promise<CustomNodeDocument> {
        logger.info(
            `[CustomNodeService] Creating custom node for user: ${userId}, name: ${data.name}`,
        );

        const nodes = data.nodes as NodeWithData[];
        const edges = data.edges as GraphEdge[];

        // Validate: must have at least one input and one output
        const { inputs, outputs } = this.extractInterface(nodes);
        if (inputs.length === 0 || outputs.length === 0) {
            throw new Error(
                "Custom node must have at least one Workflow Input and one Workflow Output node",
            );
        }

        // Validate: no cycles
        if (detectCycle(nodes, edges)) {
            throw new Error("Custom node contains a cycle");
        }

        const nodesRef = this.firestore.collection(COLLECTIONS.CUSTOM_NODES);

        const nodeData = {
            userId,
            name: data.name,
            nodes: data.nodes,
            edges: data.edges,
            version: 1,
            inputs,
            outputs,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const docRef = await nodesRef.add(nodeData);

        return {
            id: docRef.id,
            ...nodeData,
        };
    }

    async updateCustomNode(
        nodeId: string,
        userId: string,
        data: CustomNodeUpdateRequest,
    ): Promise<CustomNodeDocument> {
        logger.info(
            `[CustomNodeService] Updating custom node: ${nodeId} for user: ${userId}`,
        );
        const nodeRef = this.firestore
            .collection(COLLECTIONS.CUSTOM_NODES)
            .doc(nodeId);
        const nodeDoc = await nodeRef.get();

        if (!nodeDoc.exists) {
            throw new Error("Custom node not found");
        }

        const existingData = nodeDoc.data();
        if (existingData?.userId !== userId) {
            throw new Error("Unauthorized");
        }

        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (data.name !== undefined) {
            updateData.name = data.name;
        }

        if (data.thumbnail !== undefined) {
            updateData.thumbnail = data.thumbnail;
        }

        if (data.nodes !== undefined && data.edges !== undefined) {
            const nodes = data.nodes as NodeWithData[];
            const edges = data.edges as GraphEdge[];

            // Validate: must have at least one input and one output
            const { inputs, outputs } = this.extractInterface(nodes);
            if (inputs.length === 0 || outputs.length === 0) {
                throw new Error(
                    "Custom node must have at least one Workflow Input and one Workflow Output node",
                );
            }

            // Validate: no cycles
            if (detectCycle(nodes, edges)) {
                throw new Error("Custom node contains a cycle");
            }

            // Check for recursive cycles
            const fetchCustomNode = async (id: string) => {
                try {
                    const doc = await this.firestore
                        .collection(COLLECTIONS.CUSTOM_NODES)
                        .doc(id)
                        .get();
                    if (!doc.exists) return null;
                    return { nodes: (doc.data()?.nodes as GraphNode[]) || [] };
                } catch {
                    return null;
                }
            };

            const subWorkflowNodes = nodes.filter(
                (n) =>
                    n.type === "custom-workflow" ||
                    n.data?.type === "custom-workflow",
            );
            for (const node of subWorkflowNodes) {
                const subId = node.data?.subWorkflowId;
                if (subId) {
                    if (
                        await detectRecursiveCycle(
                            nodeId,
                            subId,
                            fetchCustomNode,
                        )
                    ) {
                        throw new Error("Recursive cycle detected");
                    }
                }
            }

            updateData.nodes = data.nodes;
            updateData.edges = data.edges;
            updateData.inputs = inputs;
            updateData.outputs = outputs;

            // Auto-increment version on content changes
            updateData.version = (existingData.version || 0) + 1;
        }

        await nodeRef.update(updateData);

        const updatedDoc = await nodeRef.get();
        return this.transformDoc(updatedDoc);
    }

    async deleteCustomNode(
        nodeId: string,
        userId: string,
    ): Promise<{ success: boolean }> {
        logger.info(
            `[CustomNodeService] Deleting custom node: ${nodeId} for user: ${userId}`,
        );
        const nodeRef = this.firestore
            .collection(COLLECTIONS.CUSTOM_NODES)
            .doc(nodeId);
        const nodeDoc = await nodeRef.get();

        if (!nodeDoc.exists) {
            throw new Error("Custom node not found");
        }

        if (nodeDoc.data()?.userId !== userId) {
            throw new Error("Unauthorized");
        }

        await nodeRef.delete();
        return { success: true };
    }
}

export const customNodeService = new CustomNodeService();
