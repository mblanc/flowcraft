import { getFirestore, formatFirestoreTimestamp } from "@/lib/db/firestore";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import type {
    DocumentSnapshot,
    QueryDocumentSnapshot,
} from "@google-cloud/firestore";
import type { LibraryAsset, LibraryAssetType } from "@/lib/library-types";

export class LibraryService {
    private firestore = getFirestore();

    private transformDoc(
        doc: DocumentSnapshot | QueryDocumentSnapshot,
    ): LibraryAsset {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data?.userId as string,
            type: data?.type as LibraryAssetType,
            gcsUri: data?.gcsUri as string,
            mimeType: data?.mimeType as string,
            width: data?.width as number | undefined,
            height: data?.height as number | undefined,
            duration: data?.duration as number | undefined,
            aspectRatio: data?.aspectRatio as string | undefined,
            model: data?.model as string | undefined,
            tags: (data?.tags ?? []) as string[],
            provenance: data?.provenance as LibraryAsset["provenance"],
            visibility: (data?.visibility ??
                "private") as LibraryAsset["visibility"],
            createdAt: formatFirestoreTimestamp(data?.createdAt),
        };
    }

    async createAsset(
        data: Omit<LibraryAsset, "id" | "createdAt">,
    ): Promise<LibraryAsset> {
        logger.info(
            `[LibraryService] Creating asset for user: ${data.userId}, type: ${data.type}`,
        );
        const ref = this.firestore.collection(COLLECTIONS.LIBRARY_ASSETS);
        const docData = Object.fromEntries(
            Object.entries({ ...data, createdAt: new Date() }).filter(
                ([, v]) => v !== undefined,
            ),
        );
        const docRef = await ref.add(docData);
        const doc = await docRef.get();
        return this.transformDoc(doc);
    }

    async listAssets(
        userId: string,
        type?: LibraryAssetType,
        options?: {
            before?: Date;
            limit?: number;
            search?: string;
            visibility?: "private" | "public";
        },
    ): Promise<LibraryAsset[]> {
        logger.debug(
            `[LibraryService] Listing assets for user: ${userId}, type: ${type ?? "all"}`,
        );

        const ref = this.firestore.collection(COLLECTIONS.LIBRARY_ASSETS);
        const isPublicBrowse = options?.visibility === "public";
        let query: FirebaseFirestore.Query;

        if (isPublicBrowse) {
            query = ref
                .where("visibility", "==", "public")
                .orderBy("createdAt", "desc");
        } else {
            query = ref
                .where("userId", "==", userId)
                .orderBy("createdAt", "desc");
        }

        if (type && !isPublicBrowse) {
            query = query.where("type", "==", type);
        }

        if (!options?.search) {
            if (options?.before) {
                query = query.where("createdAt", "<", options.before);
            }

            if (options?.limit) {
                query = query.limit(options.limit);
            }
        }

        const snapshot = await query.get();
        const assets = snapshot.docs.map((doc) => this.transformDoc(doc));

        if (options?.search) {
            const q = options.search.toLowerCase();
            return assets.filter(
                (a) =>
                    a.provenance.prompt?.toLowerCase().includes(q) ||
                    a.provenance.sourceName.toLowerCase().includes(q) ||
                    a.tags.some((t) => t.toLowerCase().includes(q)),
            );
        }

        return assets;
    }

    async getAsset(id: string, userId: string): Promise<LibraryAsset | null> {
        logger.debug(`[LibraryService] Getting asset: ${id}`);
        const doc = await this.firestore
            .collection(COLLECTIONS.LIBRARY_ASSETS)
            .doc(id)
            .get();

        if (!doc.exists) return null;

        const asset = this.transformDoc(doc);
        if (asset.userId !== userId) return null;

        return asset;
    }

    async updateTags(
        id: string,
        userId: string,
        tags: string[],
    ): Promise<void> {
        logger.info(`[LibraryService] Updating tags for asset: ${id}`);
        const ref = this.firestore
            .collection(COLLECTIONS.LIBRARY_ASSETS)
            .doc(id);
        const doc = await ref.get();

        if (!doc.exists) throw new Error("Asset not found");
        if (doc.data()?.userId !== userId) throw new Error("Unauthorized");

        await ref.update({ tags });
    }

    async updateAsset(
        id: string,
        userId: string,
        data: { visibility: "private" | "public" },
    ): Promise<LibraryAsset> {
        logger.info(`[LibraryService] Updating asset visibility: ${id}`);
        const ref = this.firestore
            .collection(COLLECTIONS.LIBRARY_ASSETS)
            .doc(id);
        const doc = await ref.get();

        if (!doc.exists) throw new Error("Asset not found");
        if (doc.data()?.userId !== userId) throw new Error("Unauthorized");

        await ref.update({ visibility: data.visibility });

        const updated = await ref.get();
        return this.transformDoc(updated);
    }

    async deleteAsset(id: string, userId: string): Promise<void> {
        logger.info(`[LibraryService] Deleting asset: ${id}`);
        const ref = this.firestore
            .collection(COLLECTIONS.LIBRARY_ASSETS)
            .doc(id);
        const doc = await ref.get();

        if (!doc.exists) throw new Error("Asset not found");
        if (doc.data()?.userId !== userId) throw new Error("Unauthorized");

        await ref.delete();
    }
}

export const libraryService = new LibraryService();
