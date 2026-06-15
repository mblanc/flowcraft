import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanvasService } from "@/lib/services/canvas.service";
import { COLLECTIONS } from "@/lib/constants";

const { mockCollection, mockDoc, mockGet, mockAdd, mockUpdate, mockWhere } =
    vi.hoisted(() => ({
        mockCollection: vi.fn(),
        mockDoc: vi.fn(),
        mockGet: vi.fn(),
        mockAdd: vi.fn(),
        mockUpdate: vi.fn(),
        mockWhere: vi.fn(),
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

const baseData = () => ({
    userId: "owner-1",
    name: "My Canvas",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    messages: [],
    visibility: "private",
    sharedWith: [],
    sharedWithEmails: [],
    isTemplate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
});

function makeDocSnap(data: Record<string, unknown>, id = "canvas-1") {
    return { exists: true, id, data: () => data };
}

describe("CanvasService — sharing", () => {
    let service: CanvasService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockWhere.mockReturnThis();

        mockCollection.mockReturnValue({
            doc: mockDoc,
            add: mockAdd,
            where: mockWhere,
            orderBy: vi.fn().mockReturnThis(),
            get: mockGet,
        });

        mockDoc.mockReturnValue({
            get: mockGet,
            update: mockUpdate,
        });

        service = new CanvasService();
    });

    describe("getCanvas", () => {
        it("allows the owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            const canvas = await service.getCanvas("canvas-1", "owner-1");
            expect(canvas.id).toBe("canvas-1");
        });

        it("allows a user who is in sharedWithEmails", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({
                    ...baseData(),
                    sharedWith: [{ email: "viewer@example.com", role: "view" }],
                    sharedWithEmails: ["viewer@example.com"],
                }),
            );
            const canvas = await service.getCanvas(
                "canvas-1",
                "other-user",
                "viewer@example.com",
            );
            expect(canvas.id).toBe("canvas-1");
        });

        it("allows any user when visibility is public", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({ ...baseData(), visibility: "public" }),
            );
            const canvas = await service.getCanvas(
                "canvas-1",
                "random-user",
                "random@example.com",
            );
            expect(canvas.id).toBe("canvas-1");
        });

        it("rejects a non-owner with no share on a private canvas", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await expect(
                service.getCanvas(
                    "canvas-1",
                    "other-user",
                    "other@example.com",
                ),
            ).rejects.toThrow("Unauthorized");
        });

        it("throws when canvas does not exist", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "canvas-1",
                data: () => undefined,
            });
            await expect(
                service.getCanvas("canvas-1", "owner-1"),
            ).rejects.toThrow("Canvas not found");
        });
    });

    describe("updateCanvas — sharing guards", () => {
        it("allows the owner to change visibility", async () => {
            const snap = makeDocSnap(baseData());
            mockGet.mockResolvedValue(snap);
            mockUpdate.mockResolvedValue(undefined);
            mockGet
                .mockResolvedValueOnce(snap)
                .mockResolvedValueOnce(
                    makeDocSnap({ ...baseData(), visibility: "public" }),
                );
            const result = await service.updateCanvas(
                "canvas-1",
                "owner-1",
                { visibility: "public" },
                "owner@example.com",
            );
            expect(result.visibility).toBe("public");
        });

        it("rejects a non-owner trying to change visibility", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({
                    ...baseData(),
                    sharedWith: [{ email: "editor@example.com", role: "edit" }],
                    sharedWithEmails: ["editor@example.com"],
                }),
            );
            await expect(
                service.updateCanvas(
                    "canvas-1",
                    "editor-uid",
                    { visibility: "public" },
                    "editor@example.com",
                ),
            ).rejects.toThrow("Only the owner can change sharing settings");
        });

        it("syncs sharedWithEmails when sharedWith is updated", async () => {
            const snap = makeDocSnap(baseData());
            mockGet.mockResolvedValueOnce(snap).mockResolvedValueOnce(
                makeDocSnap({
                    ...baseData(),
                    sharedWith: [{ email: "a@b.com", role: "view" }],
                    sharedWithEmails: ["a@b.com"],
                }),
            );
            mockUpdate.mockResolvedValue(undefined);

            const result = await service.updateCanvas(
                "canvas-1",
                "owner-1",
                { sharedWith: [{ email: "a@b.com", role: "view" }] },
                "owner@example.com",
            );
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ sharedWithEmails: ["a@b.com"] }),
            );
            expect(result.sharedWithEmails).toEqual(["a@b.com"]);
        });
    });

    describe("listCanvases", () => {
        it("returns only the user's canvases by default (tab=my)", async () => {
            mockGet.mockResolvedValue({
                docs: [makeDocSnap(baseData())],
            });
            const result = await service.listCanvases("owner-1");
            expect(result).toHaveLength(1);
            expect(mockWhere).toHaveBeenCalledWith("userId", "==", "owner-1");
        });

        it("queries sharedWithEmails for tab=shared", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listCanvases(
                "other-user",
                "viewer@example.com",
                "shared",
            );
            expect(mockWhere).toHaveBeenCalledWith(
                "sharedWithEmails",
                "array-contains",
                "viewer@example.com",
            );
        });

        it("queries isTemplate+public for tab=community", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listCanvases("any-user", undefined, "community");
            expect(mockWhere).toHaveBeenCalledWith("isTemplate", "==", true);
        });
    });

    describe("cloneCanvas", () => {
        it("creates a new canvas owned by the caller", async () => {
            const original = makeDocSnap({
                ...baseData(),
                visibility: "public",
            });
            mockGet.mockResolvedValue(original);

            const cloneSnap = makeDocSnap(
                {
                    ...baseData(),
                    userId: "cloner-1",
                    name: "Copy of My Canvas",
                },
                "canvas-clone-1",
            );
            mockAdd.mockResolvedValue({
                id: "canvas-clone-1",
                get: () => Promise.resolve(cloneSnap),
            });

            const cloned = await service.cloneCanvas(
                "canvas-1",
                "cloner-1",
                "cloner@example.com",
            );

            expect(cloned.userId).toBe("cloner-1");
            expect(cloned.name).toBe("Copy of My Canvas");
            expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.CANVASES);
        });
    });
});
