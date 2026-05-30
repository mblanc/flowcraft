import { getFirestore } from "@/lib/firestore";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import type { StyleDocument } from "@/lib/style-types";
import { FieldValue } from "@google-cloud/firestore";
import { deleteFileByUri } from "@/lib/storage";

export interface StyleCreateRequest {
    name: string;
    description: string;
    content: string;
    referenceImageUris?: string[];
}

export interface StyleUpdateRequest {
    name?: string;
    description?: string;
    content?: string;
    referenceImageUris?: string[];
}

export class StyleNotFoundError extends Error {
    constructor(id: string) {
        super(`Style not found: ${id}`);
        this.name = "StyleNotFoundError";
    }
}

export class StyleForbiddenError extends Error {
    constructor() {
        super("Forbidden");
        this.name = "StyleForbiddenError";
    }
}

export class StyleService {
    private firestore = getFirestore();

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): StyleDocument {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data?.userId as string,
            name: data?.name as string,
            description: data?.description as string,
            content: data?.content as string,
            referenceImageUris: (data?.referenceImageUris ?? []) as string[],
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

    async listStyles(userId: string): Promise<StyleDocument[]> {
        logger.debug(`[StyleService] Listing styles for user: ${userId}`);
        const ref = this.firestore.collection(COLLECTIONS.STYLES);
        const snapshot = await ref
            .where("userId", "==", userId)
            .orderBy("updatedAt", "desc")
            .get();
        return snapshot.docs.map((doc) => this.transformDoc(doc));
    }

    async getStyle(styleId: string, userId: string): Promise<StyleDocument> {
        logger.debug(`[StyleService] Getting style: ${styleId}`);
        const doc = await this.firestore
            .collection(COLLECTIONS.STYLES)
            .doc(styleId)
            .get();

        if (!doc.exists) throw new StyleNotFoundError(styleId);

        const style = this.transformDoc(doc);
        if (style.userId !== userId) throw new StyleForbiddenError();

        return style;
    }

    async createStyle(
        userId: string,
        data: StyleCreateRequest,
    ): Promise<StyleDocument> {
        logger.debug(`[StyleService] Creating style for user: ${userId}`);
        const ref = this.firestore.collection(COLLECTIONS.STYLES).doc();
        const now = FieldValue.serverTimestamp();
        await ref.set({
            userId,
            name: data.name,
            description: data.description,
            content: data.content,
            referenceImageUris: data.referenceImageUris ?? [],
            isTemplate: false,
            createdAt: now,
            updatedAt: now,
        });

        const doc = await ref.get();
        return this.transformDoc(doc);
    }

    async updateStyle(
        styleId: string,
        userId: string,
        data: StyleUpdateRequest,
    ): Promise<StyleDocument> {
        logger.debug(`[StyleService] Updating style: ${styleId}`);
        const ref = this.firestore.collection(COLLECTIONS.STYLES).doc(styleId);
        const doc = await ref.get();

        if (!doc.exists) throw new StyleNotFoundError(styleId);
        if (doc.data()?.userId !== userId) throw new StyleForbiddenError();

        await ref.update({ ...data, updatedAt: FieldValue.serverTimestamp() });

        const updated = await ref.get();
        return this.transformDoc(updated);
    }

    async deleteStyle(styleId: string, userId: string): Promise<void> {
        logger.debug(`[StyleService] Deleting style: ${styleId}`);
        const ref = this.firestore.collection(COLLECTIONS.STYLES).doc(styleId);
        const doc = await ref.get();

        if (!doc.exists) throw new StyleNotFoundError(styleId);
        const data = doc.data();
        if (data?.userId !== userId) throw new StyleForbiddenError();

        await ref.delete();

        const uris = (data?.referenceImageUris ?? []) as string[];
        await Promise.allSettled(uris.map((uri) => deleteFileByUri(uri)));
    }
}

export const styleService = new StyleService();
