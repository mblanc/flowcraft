import { getFirestore } from "@/lib/firestore";
import { FlowCreateRequest, FlowUpdateRequest } from "@/lib/schemas";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import { detectCycle, detectRecursiveCycle } from "@/lib/graph-utils";
import {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";

export class FlowService {
    private firestore = getFirestore();

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): Record<string, unknown> {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt:
                (data?.createdAt as { toDate?: () => Date })
                    ?.toDate?.()
                    ?.toISOString() || data?.createdAt,
            updatedAt:
                (data?.updatedAt as { toDate?: () => Date })
                    ?.toDate?.()
                    ?.toISOString() || data?.updatedAt,
        } as Record<string, unknown>;
    }

    async listFlows(userId: string) {
        logger.debug(`[FlowService] Listing flows for user: ${userId}`);
        const flowsRef = this.firestore.collection(COLLECTIONS.FLOWS);
        const userFlows = await flowsRef
            .where("userId", "==", userId)
            .orderBy("updatedAt", "desc")
            .get();

        return userFlows.docs.map((doc) => this.transformDoc(doc));
    }

    async getFlow(flowId: string, userId: string) {
        logger.debug(
            `[FlowService] Getting flow: ${flowId} for user: ${userId}`,
        );
        const flowDoc = await this.firestore
            .collection(COLLECTIONS.FLOWS)
            .doc(flowId)
            .get();

        if (!flowDoc.exists) {
            throw new Error("Flow not found");
        }

        const flowData = this.transformDoc(flowDoc);

        if (flowData.userId !== userId) {
            throw new Error("Unauthorized");
        }

        return flowData;
    }

    async createFlow(userId: string, data: FlowCreateRequest) {
        logger.info(
            `[FlowService] Creating flow for user: ${userId}, name: ${data.name}`,
        );
        const flowsRef = this.firestore.collection(COLLECTIONS.FLOWS);

        const flowData = {
            userId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const docRef = await flowsRef.add(flowData);

        return {
            id: docRef.id,
            ...flowData,
            createdAt: flowData.createdAt.toISOString(),
            updatedAt: flowData.updatedAt.toISOString(),
        };
    }

    async updateFlow(flowId: string, userId: string, data: FlowUpdateRequest) {
        logger.info(
            `[FlowService] Updating flow: ${flowId} for user: ${userId}`,
        );
        const flowRef = this.firestore
            .collection(COLLECTIONS.FLOWS)
            .doc(flowId);
        const flowDoc = await flowRef.get();

        if (!flowDoc.exists) {
            throw new Error("Flow not found");
        }

        if (flowDoc.data()?.userId !== userId) {
            throw new Error("Unauthorized");
        }

        const updateData: Record<string, unknown> = {
            ...data,
            updatedAt: new Date(),
        };

        await flowRef.update(updateData);

        const updatedDoc = await flowRef.get();
        return this.transformDoc(updatedDoc);
    }

    async deleteFlow(flowId: string, userId: string) {
        logger.info(
            `[FlowService] Deleting flow: ${flowId} for user: ${userId}`,
        );
        const flowRef = this.firestore
            .collection(COLLECTIONS.FLOWS)
            .doc(flowId);
        const flowDoc = await flowRef.get();

        if (!flowDoc.exists) {
            throw new Error("Flow not found");
        }

        if (flowDoc.data()?.userId !== userId) {
            throw new Error("Unauthorized");
        }

        await flowRef.delete();
        return { success: true };
    }

    async publishFlow(flowId: string, userId: string) {
        logger.info(`[FlowService] Publishing flow: ${flowId} for user: ${userId}`);
        
        const flowRef = this.firestore.collection(COLLECTIONS.FLOWS).doc(flowId);
        const flowDoc = await flowRef.get();

        if (!flowDoc.exists) {
            throw new Error("Flow not found");
        }

        const flowData = this.transformDoc(flowDoc);

        if (flowData.userId !== userId) {
            throw new Error("Unauthorized");
        }

        const nodes = (flowData.nodes as any[]) || [];
        const edges = (flowData.edges as any[]) || [];

        // 1. Validate Interface - check both top-level type and data.type
        const hasInput = nodes.some(n => n.type === 'workflow-input' || n.data?.type === 'workflow-input');
        const hasOutput = nodes.some(n => n.type === 'workflow-output' || n.data?.type === 'workflow-output');

        if (!hasInput || !hasOutput) {
             throw new Error("Flow must have at least one Workflow Input and one Workflow Output node");
        }

        // 2. Validate Cycle (DAG)
        if (detectCycle(nodes, edges)) {
            throw new Error("Flow contains a cycle");
        }

        // 3. Validate Recursive Cycle
        const fetchFlow = async (id: string) => {
            try {
                const doc = await this.firestore.collection(COLLECTIONS.FLOWS).doc(id).get();
                if (!doc.exists) return null;
                return { nodes: (doc.data()?.nodes as any[]) || [] };
            } catch (e) {
                return null;
            }
        };

        const subWorkflowNodes = nodes.filter(n => n.type === 'custom-workflow');
        for (const node of subWorkflowNodes) {
             const subId = node.data?.subWorkflowId;
             if (subId) {
                 if (await detectRecursiveCycle(flowId, subId, fetchFlow)) {
                      throw new Error("Recursive cycle detected");
                 }
             }
        }

        // 4. Create Version
        const versionsRef = flowRef.collection('versions');
        const versionsSnapshot = await versionsRef.count().get();
        const versionNumber = versionsSnapshot.data().count + 1;
        const version = `1.0.${versionNumber}`;

        const versionData = {
            ...flowData,
            version,
            publishedAt: new Date(),
        };
        delete (versionData as any).id;

        await versionsRef.add(versionData);

        // 5. Update Main Flow
        await flowRef.update({
            isPublished: true,
            publishedVersion: version,
            updatedAt: new Date(),
        });

        return {
            ...flowData,
            isPublished: true,
            publishedVersion: version,
            version, 
        };
    }

    async getFlowVersion(flowId: string, version: string, userId: string) {
        logger.debug(`[FlowService] Getting version ${version} of flow: ${flowId}`);
        
        const flowRef = this.firestore.collection(COLLECTIONS.FLOWS).doc(flowId);
        const versionsRef = flowRef.collection('versions');
        
        const versionQuery = await versionsRef.where('version', '==', version).limit(1).get();
        
        if (versionQuery.empty) {
            throw new Error("Version not found");
        }

        const versionDoc = versionQuery.docs[0];
        const versionData = this.transformDoc(versionDoc);

        // We could check visibility here if we support public flows
        if (versionData.userId !== userId && versionData.visibility !== 'public') {
            throw new Error("Unauthorized");
        }

        return versionData;
    }

    async listPublishedFlows(userId: string, filter: 'mine' | 'public' | 'all' = 'all') {
        logger.debug(`[FlowService] Listing published flows for user: ${userId}, filter: ${filter}`);
        
        let query = this.firestore.collection(COLLECTIONS.FLOWS)
            .where("isPublished", "==", true);

        if (filter === 'mine') {
            query = query.where("userId", "==", userId);
        } else if (filter === 'public') {
            query = query.where("visibility", "==", "public");
        }
        // 'all' logic: we need to handle this with a more complex query or multiple queries
        // since Firestore doesn't support OR on different fields easily without IN.
        // For now, let's keep it simple and just do 'mine' or 'public' if not all.
        // If 'all', we fetch both or just return everything that is published and (mine OR public).
        
        const snapshot = await query.orderBy("updatedAt", "desc").get();
        let flows = snapshot.docs.map(doc => this.transformDoc(doc));

        if (filter === 'all') {
            // Filter in-memory for (mine OR public)
            flows = flows.filter(f => f.userId === userId || f.visibility === 'public');
        }

        return flows;
    }
}

export const flowService = new FlowService();
