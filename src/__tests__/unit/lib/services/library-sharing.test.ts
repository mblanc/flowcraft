import { describe, it, expect, vi, beforeEach } from "vitest";
import { LibraryService } from "@/lib/services/library.service";

const { mockCollection, mockDoc, mockGet, mockUpdate, mockWhere, mockLimit } =
    vi.hoisted(() => ({
        mockCollection: vi.fn(),
        mockDoc: vi.fn(),
        mockGet: vi.fn(),
        mockUpdate: vi.fn(),
        mockWhere: vi.fn(),
        mockLimit: vi.fn(),
    }));

vi.mock("@/lib/db/firestore", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/db/firestore")>();
    return {
        ...actual,
        getFirestore: () => ({
            collection: mockCollection,
        }),
    };
});

const baseAssetData = () => ({
    userId: "owner-1",
    type: "image",
    gcsUri: "gs://bucket/img.png",
    mimeType: "image/png",
    tags: [],
    visibility: "private",
    provenance: {
        sourceType: "canvas",
        sourceId: "canvas-1",
        sourceName: "My Canvas",
    },
    createdAt: new Date(),
});

function makeDocSnap(data: Record<string, unknown>, id = "asset-1") {
    return { exists: true, id, data: () => data };
}

describe("LibraryService — sharing", () => {
    let service: LibraryService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockWhere.mockReturnThis();

        mockLimit.mockReturnThis();
        mockCollection.mockReturnValue({
            doc: mockDoc,
            where: mockWhere,
            orderBy: vi.fn().mockReturnThis(),
            limit: mockLimit,
            get: mockGet,
        });

        mockDoc.mockReturnValue({
            get: mockGet,
            update: mockUpdate,
        });

        service = new LibraryService();
    });

    describe("updateAsset", () => {
        it("updates visibility to public for the owner", async () => {
            const snap = makeDocSnap(baseAssetData());
            mockGet
                .mockResolvedValueOnce(snap)
                .mockResolvedValueOnce(
                    makeDocSnap({ ...baseAssetData(), visibility: "public" }),
                );
            mockUpdate.mockResolvedValue(undefined);

            const result = await service.updateAsset("asset-1", "owner-1", {
                visibility: "public",
            });

            expect(mockUpdate).toHaveBeenCalledWith({ visibility: "public" });
            expect(result.visibility).toBe("public");
        });

        it("throws when asset does not exist", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "asset-1",
                data: () => undefined,
            });

            await expect(
                service.updateAsset("asset-1", "owner-1", {
                    visibility: "public",
                }),
            ).rejects.toThrow("Asset not found");
        });

        it("throws Unauthorized for a non-owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseAssetData()));

            await expect(
                service.updateAsset("asset-1", "other-user", {
                    visibility: "public",
                }),
            ).rejects.toThrow("Unauthorized");
        });
    });

    describe("getAsset", () => {
        it("returns asset for the owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseAssetData()));
            const result = await service.getAsset("asset-1", "owner-1");
            expect(result?.id).toBe("asset-1");
        });

        it("returns null for non-owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseAssetData()));
            const result = await service.getAsset("asset-1", "stranger");
            expect(result).toBeNull();
        });

        it("returns null when asset does not exist", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "asset-1",
                data: () => undefined,
            });
            const result = await service.getAsset("asset-1", "owner-1");
            expect(result).toBeNull();
        });
    });

    describe("updateTags", () => {
        it("updates tags for the owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseAssetData()));
            mockUpdate.mockResolvedValue(undefined);
            await service.updateTags("asset-1", "owner-1", ["a", "b"]);
            expect(mockUpdate).toHaveBeenCalledWith({ tags: ["a", "b"] });
        });

        it("throws Unauthorized for non-owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseAssetData()));
            await expect(
                service.updateTags("asset-1", "stranger", ["a"]),
            ).rejects.toThrow("Unauthorized");
        });

        it("throws when asset not found", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "asset-1",
                data: () => undefined,
            });
            await expect(
                service.updateTags("asset-1", "owner-1", []),
            ).rejects.toThrow("Asset not found");
        });
    });

    describe("deleteAsset", () => {
        it("deletes asset for the owner", async () => {
            const snap = makeDocSnap(baseAssetData());
            const mockDelete = vi.fn().mockResolvedValue(undefined);
            mockDoc.mockReturnValue({
                get: mockGet,
                update: mockUpdate,
                delete: mockDelete,
            });
            mockGet.mockResolvedValue(snap);
            await service.deleteAsset("asset-1", "owner-1");
            expect(mockDelete).toHaveBeenCalled();
        });

        it("throws Unauthorized for non-owner on delete", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseAssetData()));
            await expect(
                service.deleteAsset("asset-1", "stranger"),
            ).rejects.toThrow("Unauthorized");
        });
    });

    describe("listAssets — visibility filter", () => {
        it("queries by userId for default (private) listing", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listAssets("owner-1");
            expect(mockWhere).toHaveBeenCalledWith("userId", "==", "owner-1");
        });

        it("queries by visibility=public when visibility option is public", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listAssets("any-user", undefined, {
                visibility: "public",
            });
            expect(mockWhere).toHaveBeenCalledWith(
                "visibility",
                "==",
                "public",
            );
        });

        it("does not filter by userId when listing public assets", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listAssets("any-user", undefined, {
                visibility: "public",
            });
            expect(mockWhere).not.toHaveBeenCalledWith(
                "userId",
                "==",
                "any-user",
            );
        });
    });

    describe("listAssets — pagination", () => {
        it("applies the default limit of 50 when no limit is specified", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listAssets("owner-1");
            expect(mockLimit).toHaveBeenCalledWith(
                LibraryService.DEFAULT_ASSETS_LIMIT,
            );
        });

        it("caps the limit at MAX_ASSETS_LIMIT even if a higher value is requested", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listAssets("owner-1", undefined, { limit: 9999 });
            expect(mockLimit).toHaveBeenCalledWith(
                LibraryService.MAX_ASSETS_LIMIT,
            );
        });

        it("applies the limit even when a search term is provided", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listAssets("owner-1", undefined, {
                search: "sunset",
            });
            expect(mockLimit).toHaveBeenCalledWith(
                LibraryService.DEFAULT_ASSETS_LIMIT,
            );
        });
    });
});
