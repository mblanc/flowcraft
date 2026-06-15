import { getFirestore, formatFirestoreTimestamp } from "@/lib/db/firestore";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import type {
    CanvasDocument,
    CanvasNode,
    ChatMessage,
} from "@/lib/canvas/types";
import type { CanvasSharingPatch } from "@/lib/schemas";

export interface CanvasCreateRequest {
    name: string;
}

export interface CanvasUpdateRequest {
    name?: string;
    nodes?: CanvasNode[];
    viewport?: { x: number; y: number; zoom: number };
    messages?: ChatMessage[];
    thumbnail?: string;
    activeStyleId?: string | null;
    visibility?: CanvasSharingPatch["visibility"];
    sharedWith?: CanvasSharingPatch["sharedWith"];
    isTemplate?: boolean;
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
            sharedWith: (data?.sharedWith ??
                []) as CanvasDocument["sharedWith"],
            sharedWithEmails: (data?.sharedWithEmails ?? []) as string[],
            isTemplate: (data?.isTemplate ?? false) as boolean,
            activeStyleId:
                (data?.activeStyleId as string | undefined) ?? undefined,
            createdAt: formatFirestoreTimestamp(data?.createdAt),
            updatedAt: formatFirestoreTimestamp(data?.updatedAt),
        };
    }

    async listCanvases(
        userId: string,
        userEmail?: string,
        tab: string = "my",
    ): Promise<CanvasDocument[]> {
        logger.debug(
            `[CanvasService] Listing canvases for user: ${userId}, tab: ${tab}`,
        );
        const ref = this.firestore.collection(COLLECTIONS.CANVASES);
        let query;

        if (tab === "shared" && userEmail) {
            query = ref
                .where("sharedWithEmails", "array-contains", userEmail)
                .orderBy("updatedAt", "desc");
        } else if (tab === "community") {
            query = ref
                .where("isTemplate", "==", true)
                .where("visibility", "==", "public")
                .orderBy("updatedAt", "desc");
        } else {
            query = ref
                .where("userId", "==", userId)
                .orderBy("updatedAt", "desc");
        }

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
        const isShared =
            userEmail && canvas.sharedWithEmails.includes(userEmail);
        const isPublic = canvas.visibility === "public";

        if (!isOwner && !isShared && !isPublic) {
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
        const isEditor =
            userEmail &&
            current.sharedWith.some(
                (s) => s.email === userEmail && s.role === "edit",
            );

        if (!isOwner && !isEditor) {
            throw new Error("Unauthorized");
        }

        const isChangingVisibility = data.visibility !== undefined;
        const isChangingSharedWith = data.sharedWith !== undefined;
        const isChangingTemplate = data.isTemplate !== undefined;

        if (
            (isChangingVisibility ||
                isChangingSharedWith ||
                isChangingTemplate) &&
            !isOwner
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

        await ref.update(updateData);

        const updatedDoc = await ref.get();
        return this.transformDoc(updatedDoc);
    }

    async deleteCanvas(
        canvasId: string,
        userId: string,
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

        if (doc.data()?.userId !== userId) {
            throw new Error("Unauthorized");
        }

        await ref.delete();
        return { success: true };
    }

    async cloneCanvas(
        canvasId: string,
        userId: string,
        userEmail?: string,
    ): Promise<CanvasDocument> {
        logger.info(
            `[CanvasService] Cloning canvas: ${canvasId} for user: ${userId}`,
        );

        const original = await this.getCanvas(canvasId, userId, userEmail);

        const ref = this.firestore.collection(COLLECTIONS.CANVASES);
        const docRef = await ref.add({
            userId,
            name: `Copy of ${original.name}`,
            nodes: original.nodes,
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            messages: [],
            visibility: "private" as const,
            sharedWith: [],
            sharedWithEmails: [],
            isTemplate: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const doc = await docRef.get();
        return this.transformDoc(doc);
    }
}

export const canvasService = new CanvasService();
