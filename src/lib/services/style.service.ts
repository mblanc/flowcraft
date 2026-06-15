import { getFirestore, formatFirestoreTimestamp } from "@/lib/db/firestore";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import type { StyleDocument } from "@/lib/styles/style-types";
import { FieldValue } from "@google-cloud/firestore";
import { deleteFileByUri } from "@/lib/db/storage";
import type { StyleSharingPatch } from "@/lib/schemas";
import { isAdmin } from "@/lib/services/admin";

export type StyleListTab = "my" | "shared" | "community";

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
    visibility?: StyleSharingPatch["visibility"];
    sharedWith?: StyleSharingPatch["sharedWith"];
    isTemplate?: boolean;
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
            visibility: (data?.visibility ??
                "private") as StyleDocument["visibility"],
            sharedWith: (data?.sharedWith ?? []) as StyleDocument["sharedWith"],
            sharedWithEmails: (data?.sharedWithEmails ?? []) as string[],
            isTemplate: (data?.isTemplate ?? false) as boolean,
            createdAt: formatFirestoreTimestamp(data?.createdAt),
            updatedAt: formatFirestoreTimestamp(data?.updatedAt),
        };
    }

    async listStyles(
        userId: string,
        userEmail?: string,
        tab: StyleListTab = "my",
    ): Promise<StyleDocument[]> {
        logger.debug(
            `[StyleService] Listing styles for user: ${userId}, tab: ${tab}`,
        );
        const ref = this.firestore.collection(COLLECTIONS.STYLES);
        let query;

        if (tab === "shared") {
            if (!userEmail) return [];
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

    async getStyle(
        styleId: string,
        userId: string,
        userEmail?: string,
    ): Promise<StyleDocument> {
        logger.debug(`[StyleService] Getting style: ${styleId}`);
        const doc = await this.firestore
            .collection(COLLECTIONS.STYLES)
            .doc(styleId)
            .get();

        if (!doc.exists) throw new StyleNotFoundError(styleId);

        const style = this.transformDoc(doc);

        const isOwner = style.userId === userId;
        const isShared =
            userEmail && style.sharedWithEmails.includes(userEmail);
        const isPublic = style.visibility === "public";

        if (!isOwner && !isShared && !isPublic) throw new StyleForbiddenError();

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
            visibility: "private",
            sharedWith: [],
            sharedWithEmails: [],
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
        userEmail?: string,
    ): Promise<StyleDocument> {
        logger.debug(`[StyleService] Updating style: ${styleId}`);
        const ref = this.firestore.collection(COLLECTIONS.STYLES).doc(styleId);
        const doc = await ref.get();

        if (!doc.exists) throw new StyleNotFoundError(styleId);

        const current = this.transformDoc(doc);
        const isOwner = current.userId === userId;
        const isEditor =
            userEmail &&
            current.sharedWith.some(
                (s) => s.email === userEmail && s.role === "edit",
            );

        if (!isOwner && !isEditor) throw new StyleForbiddenError();

        const isChangingSharing =
            data.visibility !== undefined || data.sharedWith !== undefined;

        if (isChangingSharing && !isOwner) {
            throw new Error("Only the owner can change sharing settings");
        }

        if (
            data.isTemplate !== undefined &&
            data.isTemplate !== current.isTemplate
        ) {
            if (!isAdmin(userEmail)) {
                throw new Error("Only admins can change template status");
            }
        }

        const updateData: Record<string, unknown> = {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (data.sharedWith) {
            updateData.sharedWithEmails = data.sharedWith.map((s) => s.email);
        }

        await ref.update(updateData);

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

    async cloneStyle(
        styleId: string,
        userId: string,
        userEmail?: string,
    ): Promise<StyleDocument> {
        logger.info(
            `[StyleService] Cloning style: ${styleId} for user: ${userId}`,
        );

        const original = await this.getStyle(styleId, userId, userEmail);

        const ref = this.firestore.collection(COLLECTIONS.STYLES);
        const now = FieldValue.serverTimestamp();
        const docRef = await ref.add({
            userId,
            name: `Copy of ${original.name}`,
            description: original.description,
            content: original.content,
            referenceImageUris: original.referenceImageUris,
            visibility: "private",
            sharedWith: [],
            sharedWithEmails: [],
            isTemplate: false,
            createdAt: now,
            updatedAt: now,
        });

        const doc = await docRef.get();
        return this.transformDoc(doc);
    }
}

export const styleService = new StyleService();
