import { getFirestore } from "@/lib/firestore";
import { FlowCreateRequest, FlowUpdateRequest } from "@/lib/schemas";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
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
}

export const flowService = new FlowService();
