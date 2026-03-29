import { getFirestore } from "@/lib/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { config } from "@/lib/config";
import logger from "@/app/logger";
import type {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import type {
    CanvasDocument,
    CanvasNode,
    ChatMessage,
} from "@/lib/canvas-types";

export interface CanvasCreateRequest {
    name: string;
}

export interface CanvasUpdateRequest {
    name?: string;
    nodes?: CanvasNode[];
    viewport?: { x: number; y: number; zoom: number };
    messages?: ChatMessage[];
    thumbnail?: string;
}

export class CanvasService {
    private firestore = getFirestore();

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): CanvasDocument {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data?.userId as string,
            name: data?.name as string,
            thumbnail: data?.thumbnail as string | undefined,
            nodes: (data?.nodes ?? []) as CanvasNode[],
            edges: [] as never[],
            viewport: (data?.viewport ?? {
                x: 0,
                y: 0,
                zoom: 1,
            }) as CanvasDocument["viewport"],
            messages: (data?.messages ?? []) as ChatMessage[],
            visibility: (data?.visibility ??
                "private") as CanvasDocument["visibility"],
            sharedWith: (data?.sharedWith ?? []) as string[],
            sharedWithEmails: (data?.sharedWithEmails ?? []) as string[],
            isTemplate: (data?.isTemplate ?? false) as boolean,
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

    private async isAdmin(email: string): Promise<boolean> {
        if (!email) return false;
        const adminEmails = config.ADMIN_EMAILS.split(",").map((e: string) =>
            e.trim().toLowerCase(),
        );
        return adminEmails.includes(email.toLowerCase());
    }

    async listCanvases(userId: string): Promise<CanvasDocument[]> {
        logger.debug(`[CanvasService] Listing canvases for user: ${userId}`);
        const ref = this.firestore.collection(COLLECTIONS.CANVASES);
        const query = ref
            .where("userId", "==", userId)
            .orderBy("updatedAt", "desc");
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => this.transformDoc(doc));
    }

    async getCanvas(
        canvasId: string,
        userId: string,
        userEmail?: string,
    ): Promise<CanvasDocument> {
        logger.debug(
            `[CanvasService] Getting canvas: ${canvasId} for user: ${userId}`,
        );
        const doc = await this.firestore
            .collection(COLLECTIONS.CANVASES)
            .doc(canvasId)
            .get();

        if (!doc.exists) {
            throw new Error("Canvas not found");
        }

        const canvas = this.transformDoc(doc);
        const isOwner = canvas.userId === userId;
        const isAdminUser = userEmail ? await this.isAdmin(userEmail) : false;

        if (!isOwner && !isAdminUser) {
            throw new Error("Unauthorized");
        }

        return canvas;
    }

    async createCanvas(
        userId: string,
        data: CanvasCreateRequest,
    ): Promise<CanvasDocument> {
        logger.info(
            `[CanvasService] Creating canvas for user: ${userId}, name: ${data.name}`,
        );
        const ref = this.firestore.collection(COLLECTIONS.CANVASES);

        const canvasData = {
            userId,
            name: data.name,
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            messages: [],
            visibility: "private" as const,
            sharedWith: [],
            sharedWithEmails: [],
            isTemplate: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const docRef = await ref.add(canvasData);

        return {
            id: docRef.id,
            ...canvasData,
            edges: [] as never[],
            createdAt: canvasData.createdAt.toISOString(),
            updatedAt: canvasData.updatedAt.toISOString(),
        };
    }

    async updateCanvas(
        canvasId: string,
        userId: string,
        data: CanvasUpdateRequest,
        userEmail?: string,
    ): Promise<CanvasDocument> {
        logger.info(
            `[CanvasService] Updating canvas: ${canvasId} for user: ${userId}`,
        );
        const ref = this.firestore
            .collection(COLLECTIONS.CANVASES)
            .doc(canvasId);
        const doc = await ref.get();

        if (!doc.exists) {
            throw new Error("Canvas not found");
        }

        const current = this.transformDoc(doc);
        const isOwner = current.userId === userId;
        const isAdminUser = userEmail ? await this.isAdmin(userEmail) : false;

        if (!isOwner && !isAdminUser) {
            throw new Error("Unauthorized");
        }

        const updateData: Record<string, unknown> = {
            ...data,
            updatedAt: new Date(),
        };

        await ref.update(updateData);

        const updatedDoc = await ref.get();
        return this.transformDoc(updatedDoc);
    }

    async deleteCanvas(
        canvasId: string,
        userId: string,
        userEmail?: string,
    ): Promise<{ success: true }> {
        logger.info(
            `[CanvasService] Deleting canvas: ${canvasId} for user: ${userId}`,
        );
        const ref = this.firestore
            .collection(COLLECTIONS.CANVASES)
            .doc(canvasId);
        const doc = await ref.get();

        if (!doc.exists) {
            throw new Error("Canvas not found");
        }

        const isAdminUser = userEmail ? await this.isAdmin(userEmail) : false;
        if (doc.data()?.userId !== userId && !isAdminUser) {
            throw new Error("Unauthorized");
        }

        await ref.delete();
        return { success: true };
    }
}

export const canvasService = new CanvasService();
