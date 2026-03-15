import { getFirestore } from "@/lib/firestore";
import { FlowCreateRequest, FlowUpdateRequest } from "@/lib/schemas";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import { FlowDocument } from "@/lib/firestore";
import { config } from "@/lib/config";

export class FlowService {
    private firestore = getFirestore();

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): FlowDocument {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data?.userId as string,
            name: data?.name as string,
            nodes: (data?.nodes ?? []) as FlowDocument["nodes"],
            edges: (data?.edges ?? []) as FlowDocument["edges"],
            thumbnail: data?.thumbnail as string | undefined,
            visibility: (data?.visibility ??
                "private") as FlowDocument["visibility"],
            sharedWith: data?.sharedWith as FlowDocument["sharedWith"],
            sharedWithEmails: data?.sharedWithEmails as string[] | undefined,
            isTemplate: data?.isTemplate as boolean | undefined,
            createdAt:
                (data?.createdAt as { toDate?: () => Date })
                    ?.toDate?.()
                    ?.toISOString() ?? String(data?.createdAt ?? ""),
            updatedAt:
                (data?.updatedAt as { toDate?: () => Date })
                    ?.toDate?.()
                    ?.toISOString() ?? String(data?.updatedAt ?? ""),
        };
    }

    async listFlows(userId: string, userEmail?: string, tab: string = "my") {
        logger.debug(
            `[FlowService] Listing flows for user: ${userId}, tab: ${tab}`,
        );
        const flowsRef = this.firestore.collection(COLLECTIONS.FLOWS);
        let query;

        if (tab === "shared" && userEmail) {
            query = flowsRef
                .where("sharedWithEmails", "array-contains", userEmail)
                .orderBy("updatedAt", "desc");
        } else if (tab === "community") {
            query = flowsRef
                .where("isTemplate", "==", true)
                .where("visibility", "==", "public")
                .orderBy("updatedAt", "desc");
        } else {
            // Default to "my"
            query = flowsRef
                .where("userId", "==", userId)
                .orderBy("updatedAt", "desc");
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => this.transformDoc(doc));
    }

    async getFlow(flowId: string, userId: string, userEmail?: string) {
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

        const isOwner = flowData.userId === userId;
        const isShared =
            userEmail && flowData.sharedWithEmails?.includes(userEmail);
        const isPublic = flowData.visibility === "public";

        if (!isOwner && !isShared && !isPublic) {
            throw new Error("Unauthorized");
        }

        return flowData;
    }

    async isAdmin(email: string) {
        if (!email) return false;
        const adminEmails = config.ADMIN_EMAILS.split(",").map((e: string) =>
            e.trim().toLowerCase(),
        );
        return adminEmails.includes(email.toLowerCase());
    }

    async createFlow(userId: string, data: FlowCreateRequest) {
        logger.info(
            `[FlowService] Creating flow for user: ${userId}, name: ${data.name}`,
        );
        const flowsRef = this.firestore.collection(COLLECTIONS.FLOWS);

        const flowData = {
            userId,
            ...data,
            visibility: "private" as const,
            isTemplate: false,
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

    async updateFlow(
        flowId: string,
        userId: string,
        data: FlowUpdateRequest,
        userEmail?: string,
    ) {
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

        const currentData = this.transformDoc(flowDoc);
        const isOwner = currentData.userId === userId;
        const isEditor =
            userEmail &&
            currentData.sharedWith?.some(
                (s: { email: string; role: string }) =>
                    s.email === userEmail && s.role === "edit",
            );

        const isAdmin = userEmail ? await this.isAdmin(userEmail) : false;

        if (!isOwner && !isEditor && !isAdmin) {
            throw new Error("Unauthorized");
        }

        // Only admins can change isTemplate status
        if (
            data.isTemplate !== undefined &&
            data.isTemplate !== currentData.isTemplate
        ) {
            const isAdmin = await this.isAdmin(userEmail || "");
            if (!isAdmin) {
                throw new Error("Only admins can change template status");
            }
            // If setting as template, ensure it's public
            if (data.isTemplate) {
                data.visibility = "public";
            }
        }

        // Restriction: Only owner or admin can change visibility and sharing settings
        const isChangingVisibility =
            data.visibility !== undefined &&
            data.visibility !== currentData.visibility;
        const isChangingSharedWith = data.sharedWith !== undefined;

        if (
            (isChangingVisibility || isChangingSharedWith) &&
            !isOwner &&
            !isAdmin
        ) {
            throw new Error("Only the owner can change sharing settings");
        }

        const updateData: Record<string, unknown> = {
            ...data,
            updatedAt: new Date(),
        };

        if (data.sharedWith) {
            updateData.sharedWithEmails = data.sharedWith.map((s) => s.email);
        }

        await flowRef.update(updateData);

        const updatedDoc = await flowRef.get();
        return this.transformDoc(updatedDoc);
    }

    async deleteFlow(flowId: string, userId: string, userEmail?: string) {
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

        const isAdmin = userEmail ? await this.isAdmin(userEmail) : false;
        if (flowDoc.data()?.userId !== userId && !isAdmin) {
            throw new Error("Unauthorized");
        }

        await flowRef.delete();
        return { success: true };
    }

    async cloneFlow(flowId: string, userId: string, userEmail?: string) {
        logger.info(
            `[FlowService] Cloning flow: ${flowId} for user: ${userId}`,
        );

        // Get the original flow (this also checks permissions)
        const originalFlow = await this.getFlow(flowId, userId, userEmail);

        const cloneData: FlowCreateRequest = {
            name: `Copy of ${originalFlow.name}`,
            nodes: originalFlow.nodes,
            edges: originalFlow.edges,
        };

        return this.createFlow(userId, cloneData);
    }
}

export const flowService = new FlowService();
