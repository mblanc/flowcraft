import { getFirestore, formatFirestoreTimestamp } from "@/lib/db/firestore";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import { FieldValue } from "@google-cloud/firestore";
import type { Rule } from "@/lib/schemas";

export interface RulesetDocument {
    id: string;
    userId: string;
    name: string;
    description?: string;
    rules: Rule[];
    visibility: "private" | "public";
    sharedWith: { email: string; role: "view" | "edit" }[];
    sharedWithEmails: string[];
    createdAt: string;
    updatedAt: string;
}

export interface RulesetCreateRequest {
    name: string;
    description?: string;
    rules?: Rule[];
    visibility?: "private" | "public";
    sharedWith?: { email: string; role: "view" | "edit" }[];
}

export interface RulesetUpdateRequest {
    name?: string;
    description?: string;
    rules?: Rule[];
    visibility?: "private" | "public";
    sharedWith?: { email: string; role: "view" | "edit" }[];
}

export type RulesetListTab = "my" | "shared" | "community";

export class RulesetNotFoundError extends Error {
    constructor(id: string) {
        super(`Ruleset not found: ${id}`);
        this.name = "RulesetNotFoundError";
    }
}

export class RulesetForbiddenError extends Error {
    constructor(message = "Forbidden") {
        super(message);
        this.name = "RulesetForbiddenError";
    }
}

export class RulesetService {
    private firestore = getFirestore();

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): RulesetDocument {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data?.userId as string,
            name: data?.name as string,
            description: data?.description as string | undefined,
            rules: (data?.rules ?? []) as Rule[],
            visibility: (data?.visibility ??
                "private") as RulesetDocument["visibility"],
            sharedWith: (data?.sharedWith ??
                []) as RulesetDocument["sharedWith"],
            sharedWithEmails: (data?.sharedWithEmails ?? []) as string[],
            createdAt: formatFirestoreTimestamp(data?.createdAt),
            updatedAt: formatFirestoreTimestamp(data?.updatedAt),
        };
    }

    async listRulesets(
        userId: string,
        userEmail?: string,
        tab: RulesetListTab = "my",
    ): Promise<RulesetDocument[]> {
        logger.debug(
            `[RulesetService] Listing rulesets for user: ${userId}, tab: ${tab}`,
        );
        const ref = this.firestore.collection(COLLECTIONS.RULESETS);
        let query;

        if (tab === "shared") {
            if (!userEmail) return [];
            query = ref
                .where("sharedWithEmails", "array-contains", userEmail)
                .orderBy("updatedAt", "desc");
        } else if (tab === "community") {
            query = ref
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

    async getRuleset(
        rulesetId: string,
        userId: string,
        userEmail?: string,
    ): Promise<RulesetDocument> {
        logger.debug(`[RulesetService] Getting ruleset: ${rulesetId}`);
        const doc = await this.firestore
            .collection(COLLECTIONS.RULESETS)
            .doc(rulesetId)
            .get();

        if (!doc.exists) throw new RulesetNotFoundError(rulesetId);

        const ruleset = this.transformDoc(doc);

        const isOwner = ruleset.userId === userId;
        const isShared =
            userEmail && ruleset.sharedWithEmails.includes(userEmail);
        const isPublic = ruleset.visibility === "public";

        if (!isOwner && !isShared && !isPublic)
            throw new RulesetForbiddenError();

        return ruleset;
    }

    async createRuleset(
        userId: string,
        data: RulesetCreateRequest,
    ): Promise<RulesetDocument> {
        logger.debug(`[RulesetService] Creating ruleset for user: ${userId}`);
        const ref = this.firestore.collection(COLLECTIONS.RULESETS).doc();
        const now = FieldValue.serverTimestamp();
        await ref.set({
            userId,
            name: data.name,
            description: data.description ?? "",
            rules: data.rules ?? [],
            visibility: data.visibility ?? "private",
            sharedWith: data.sharedWith ?? [],
            sharedWithEmails: (data.sharedWith ?? []).map((s) => s.email),
            createdAt: now,
            updatedAt: now,
        });

        const doc = await ref.get();
        return this.transformDoc(doc);
    }

    async updateRuleset(
        rulesetId: string,
        userId: string,
        data: RulesetUpdateRequest,
    ): Promise<RulesetDocument> {
        logger.debug(`[RulesetService] Updating ruleset: ${rulesetId}`);
        const ref = this.firestore
            .collection(COLLECTIONS.RULESETS)
            .doc(rulesetId);
        const doc = await ref.get();

        if (!doc.exists) throw new RulesetNotFoundError(rulesetId);

        const current = this.transformDoc(doc);
        if (current.userId !== userId) throw new RulesetForbiddenError();

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

    async deleteRuleset(rulesetId: string, userId: string): Promise<void> {
        logger.debug(`[RulesetService] Deleting ruleset: ${rulesetId}`);
        const ref = this.firestore
            .collection(COLLECTIONS.RULESETS)
            .doc(rulesetId);
        const doc = await ref.get();

        if (!doc.exists) throw new RulesetNotFoundError(rulesetId);
        const data = doc.data();
        if (data?.userId !== userId) throw new RulesetForbiddenError();

        await ref.delete();
    }
}

export const rulesetService = new RulesetService();
