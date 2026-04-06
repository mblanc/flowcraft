import { getFirestore } from "@/lib/firestore";
import { COLLECTIONS } from "@/lib/constants";
import logger from "@/app/logger";
import type { DocumentSnapshot, QueryDocumentSnapshot } from "@google-cloud/firestore";
import type { LibraryAsset, LibraryAssetType } from "@/lib/library-types";

export class LibraryService {
    private firestore = getFirestore();

    private transformDoc(doc: DocumentSnapshot | QueryDocumentSnapshot): LibraryAsset {
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
            createdAt:
                (data?.createdAt as { toDate?: () => Date })
                    ?.toDate?.()
                    ?.toISOString() ?? String(data?.createdAt ?? ""),
        };
    }

    async createAsset(data: Omit<LibraryAsset, "id" | "createdAt">): Promise<LibraryAsset> {
        logger.info(`[LibraryService] Creating asset for user: ${data.userId}, type: ${data.type}`);
        const ref = this.firestore.collection(COLLECTIONS.LIBRARY_ASSETS);
        const docRef = await ref.add({ ...data, createdAt: new Date() });
        const doc = await docRef.get();
        return this.transformDoc(doc);
    }

    async listAssets(userId: string, type?: LibraryAssetType): Promise<LibraryAsset[]> {
        logger.debug(`[LibraryService] Listing assets for user: ${userId}, type: ${type ?? "all"}`);
        let query = this.firestore
            .collection(COLLECTIONS.LIBRARY_ASSETS)
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc") as FirebaseFirestore.Query;

        if (type) {
            query = query.where("type", "==", type);
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => this.transformDoc(doc));
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

    async updateTags(id: string, userId: string, tags: string[]): Promise<void> {
        logger.info(`[LibraryService] Updating tags for asset: ${id}`);
        const ref = this.firestore.collection(COLLECTIONS.LIBRARY_ASSETS).doc(id);
        const doc = await ref.get();

        if (!doc.exists) throw new Error("Asset not found");
        if (doc.data()?.userId !== userId) throw new Error("Unauthorized");

        await ref.update({ tags });
    }

    async deleteAsset(id: string, userId: string): Promise<void> {
        logger.info(`[LibraryService] Deleting asset: ${id}`);
        const ref = this.firestore.collection(COLLECTIONS.LIBRARY_ASSETS).doc(id);
        const doc = await ref.get();

        if (!doc.exists) throw new Error("Asset not found");
        if (doc.data()?.userId !== userId) throw new Error("Unauthorized");

        await ref.delete();
    }
}

export const libraryService = new LibraryService();
