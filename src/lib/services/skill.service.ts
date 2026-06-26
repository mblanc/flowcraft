import { getFirestore, formatFirestoreTimestamp } from "@/lib/db/firestore";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import { FieldValue } from "@google-cloud/firestore";
import type { UserSkillDocument } from "@/lib/canvas/agent/skills/skill-types";
import { isAdmin } from "@/lib/services/admin";

export type SkillListTab = "my" | "community";

interface LegacySkillPhase {
    title: string;
    rules: string;
}

export interface SkillCreateRequest {
    name: string;
    description: string;
    instructions: string;
}

export interface SkillUpdateRequest {
    name?: string;
    description?: string;
    instructions?: string;
    visibility?: "private" | "public";
    isTemplate?: boolean;
}

export class SkillNotFoundError extends Error {
    constructor(id: string) {
        super(`Skill not found: ${id}`);
        this.name = "SkillNotFoundError";
    }
}

export class SkillForbiddenError extends Error {
    constructor(message = "Forbidden") {
        super(message);
        this.name = "SkillForbiddenError";
    }
}

export class SkillService {
    private firestore = getFirestore();

    private toKebabCase(str: string): string {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): UserSkillDocument {
        const data = doc.data();

        // Backward-compatible fallback: compile old phases into markdown instructions
        let instructions = data?.instructions as string;
        if (!instructions && data?.phases) {
            const phases = (data.phases ?? []) as LegacySkillPhase[];
            instructions = phases
                .map((p, idx) => `### Phase ${idx + 1}: ${p.title}\n${p.rules}`)
                .join("\n\n");
        }
        if (!instructions) {
            instructions = "";
        }

        return {
            id: doc.id,
            userId: data?.userId as string,
            name: data?.name as string,
            description: data?.description as string,
            instructions,
            visibility: (data?.visibility ?? "private") as "private" | "public",
            sharedWith: (data?.sharedWith ??
                []) as UserSkillDocument["sharedWith"],
            sharedWithEmails: (data?.sharedWithEmails ?? []) as string[],
            isTemplate: (data?.isTemplate ?? false) as boolean,
            createdAt: formatFirestoreTimestamp(data?.createdAt),
            updatedAt: formatFirestoreTimestamp(data?.updatedAt),
        };
    }

    async listSkills(
        userId: string,
        userEmail?: string,
        tab: SkillListTab = "my",
    ): Promise<UserSkillDocument[]> {
        logger.debug(
            `[SkillService] Listing skills for user: ${userId}, tab: ${tab}`,
        );
        const ref = this.firestore.collection(COLLECTIONS.USER_SKILLS);
        let query;

        if (tab === "community") {
            query = ref
                .where("visibility", "==", "public")
                .orderBy("updatedAt", "desc");
        } else {
            query = ref
                .where("userId", "==", userId)
                .orderBy("updatedAt", "desc");
        }

        const snapshot = await query.get();
        const skills = snapshot.docs.map((doc) => this.transformDoc(doc));

        // If listing 'my' skills, we also want to include those shared with the user's email
        if (tab === "my" && userEmail) {
            const sharedRef = this.firestore.collection(
                COLLECTIONS.USER_SKILLS,
            );
            const sharedQuery = sharedRef
                .where("sharedWithEmails", "array-contains", userEmail)
                .orderBy("updatedAt", "desc");
            const sharedSnapshot = await sharedQuery.get();
            const sharedSkills = sharedSnapshot.docs.map((doc) =>
                this.transformDoc(doc),
            );

            // Deduplicate in case any shared skill is also owned by the user (rare)
            const ownedIds = new Set(skills.map((s) => s.id));
            for (const skill of sharedSkills) {
                if (!ownedIds.has(skill.id)) {
                    skills.push(skill);
                }
            }

            // Sort by updatedAt descending
            skills.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }

        return skills;
    }

    async getSkill(
        skillId: string,
        userId: string,
        userEmail?: string,
    ): Promise<UserSkillDocument> {
        logger.debug(`[SkillService] Getting skill: ${skillId}`);
        const doc = await this.firestore
            .collection(COLLECTIONS.USER_SKILLS)
            .doc(skillId)
            .get();

        if (!doc.exists) throw new SkillNotFoundError(skillId);

        const skill = this.transformDoc(doc);

        const isOwner = skill.userId === userId;
        const isShared =
            userEmail && skill.sharedWithEmails.includes(userEmail);
        const isPublic = skill.visibility === "public";

        if (!isOwner && !isShared && !isPublic) throw new SkillForbiddenError();

        return skill;
    }

    async createSkill(
        userId: string,
        data: SkillCreateRequest,
    ): Promise<UserSkillDocument> {
        logger.debug(`[SkillService] Creating skill for user: ${userId}`);
        const kebabName = this.toKebabCase(data.name);
        const ref = this.firestore
            .collection(COLLECTIONS.USER_SKILLS)
            .doc(kebabName);

        // Check if a skill with this kebab-case name already exists
        const existing = await ref.get();
        if (existing.exists) {
            throw new Error(`Skill with name '${kebabName}' already exists.`);
        }

        const now = FieldValue.serverTimestamp();
        await ref.set({
            userId,
            name: kebabName,
            description: data.description,
            instructions: data.instructions,
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

    async updateSkill(
        skillId: string,
        userId: string,
        data: SkillUpdateRequest,
        userEmail?: string,
    ): Promise<UserSkillDocument> {
        logger.debug(`[SkillService] Updating skill: ${skillId}`);
        const ref = this.firestore
            .collection(COLLECTIONS.USER_SKILLS)
            .doc(skillId);
        const doc = await ref.get();

        if (!doc.exists) throw new SkillNotFoundError(skillId);

        const current = this.transformDoc(doc);
        const isOwner = current.userId === userId;
        const isEditor =
            userEmail &&
            current.sharedWith.some(
                (s) => s.email === userEmail && s.role === "edit",
            );

        if (!isOwner && !isEditor) throw new SkillForbiddenError();

        const isChangingSharing = data.visibility !== undefined;

        if (isChangingSharing && !isOwner) {
            throw new SkillForbiddenError(
                "Only the owner can change sharing settings",
            );
        }

        if (
            data.isTemplate !== undefined &&
            data.isTemplate !== current.isTemplate
        ) {
            if (!isAdmin(userEmail)) {
                throw new SkillForbiddenError(
                    "Only admins can change template status",
                );
            }
        }

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (data.name !== undefined) {
            updateData.name = this.toKebabCase(data.name);
        }
        if (data.description !== undefined) {
            updateData.description = data.description;
        }
        if (data.instructions !== undefined) {
            updateData.instructions = data.instructions;
        }
        if (data.visibility !== undefined) {
            updateData.visibility = data.visibility;
        }
        if (data.isTemplate !== undefined) {
            updateData.isTemplate = data.isTemplate;
        }

        await ref.update(updateData);

        const updated = await ref.get();
        return this.transformDoc(updated);
    }

    async deleteSkill(skillId: string, userId: string): Promise<void> {
        logger.debug(`[SkillService] Deleting skill: ${skillId}`);
        const ref = this.firestore
            .collection(COLLECTIONS.USER_SKILLS)
            .doc(skillId);
        const doc = await ref.get();

        if (!doc.exists) throw new SkillNotFoundError(skillId);
        const data = doc.data();
        if (data?.userId !== userId) throw new SkillForbiddenError();

        await ref.delete();
    }

    async cloneSkill(
        skillId: string,
        userId: string,
        userEmail?: string,
    ): Promise<UserSkillDocument> {
        logger.info(
            `[SkillService] Cloning skill: ${skillId} for user: ${userId}`,
        );

        const original = await this.getSkill(skillId, userId, userEmail);

        const now = FieldValue.serverTimestamp();
        const copyBaseName = `copy-of-${original.name}`;

        // Find a unique name in case copy-of- already exists
        let uniqueName = copyBaseName;
        let counter = 1;
        let ref = this.firestore
            .collection(COLLECTIONS.USER_SKILLS)
            .doc(uniqueName);
        let existsDoc = await ref.get();

        while (existsDoc.exists) {
            uniqueName = `${copyBaseName}-${counter}`;
            ref = this.firestore
                .collection(COLLECTIONS.USER_SKILLS)
                .doc(uniqueName);
            existsDoc = await ref.get();
            counter++;
        }

        await ref.set({
            userId,
            name: uniqueName,
            description: original.description,
            instructions: original.instructions,
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
}

export const skillService = new SkillService();
