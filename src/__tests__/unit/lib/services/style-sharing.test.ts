import { describe, it, expect, vi, beforeEach } from "vitest";
import { StyleService } from "@/lib/services/style.service";
import { COLLECTIONS } from "@/lib/constants";

const {
    mockCollection,
    mockDoc,
    mockGet,
    mockAdd,
    mockUpdate,
    mockWhere,
    mockSet,
} = vi.hoisted(() => ({
    mockCollection: vi.fn(),
    mockDoc: vi.fn(),
    mockGet: vi.fn(),
    mockAdd: vi.fn(),
    mockUpdate: vi.fn(),
    mockWhere: vi.fn(),
    mockSet: vi.fn(),
}));

vi.mock("@/lib/services/admin", () => ({
    isAdmin: (email: string | undefined | null) =>
        email === "admin@example.com",
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

vi.mock("@google-cloud/firestore", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@google-cloud/firestore")>();
    return {
        ...actual,
        FieldValue: {
            serverTimestamp: () => new Date(),
        },
    };
});

vi.mock("@/lib/db/storage", () => ({ deleteFileByUri: vi.fn() }));

const baseData = () => ({
    userId: "owner-1",
    name: "My Style",
    description: "A style",
    content: "# Content",
    referenceImageUris: [],
    visibility: "private",
    sharedWith: [],
    sharedWithEmails: [],
    isTemplate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
});

function makeDocSnap(data: Record<string, unknown>, id = "style-1") {
    return { exists: true, id, data: () => data };
}

describe("StyleService — sharing", () => {
    let service: StyleService;

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
            set: mockSet,
        });

        service = new StyleService();
    });

    describe("getStyle", () => {
        it("allows the owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            const style = await service.getStyle("style-1", "owner-1");
            expect(style.id).toBe("style-1");
        });

        it("allows a user in sharedWithEmails", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({
                    ...baseData(),
                    sharedWith: [{ email: "viewer@example.com", role: "view" }],
                    sharedWithEmails: ["viewer@example.com"],
                }),
            );
            const style = await service.getStyle(
                "style-1",
                "other-user",
                "viewer@example.com",
            );
            expect(style.id).toBe("style-1");
        });

        it("allows any user when visibility is public", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({ ...baseData(), visibility: "public" }),
            );
            const style = await service.getStyle(
                "style-1",
                "random-user",
                "random@example.com",
            );
            expect(style.id).toBe("style-1");
        });

        it("rejects a non-owner on a private style", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await expect(
                service.getStyle("style-1", "other-user", "other@example.com"),
            ).rejects.toThrow("Forbidden");
        });

        it("throws when style does not exist", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "style-1",
                data: () => undefined,
            });
            await expect(
                service.getStyle("style-1", "owner-1"),
            ).rejects.toThrow("Style not found");
        });
    });

    describe("updateStyle — sharing guards", () => {
        it("rejects a non-owner trying to change visibility", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({
                    ...baseData(),
                    sharedWith: [{ email: "editor@example.com", role: "edit" }],
                    sharedWithEmails: ["editor@example.com"],
                }),
            );
            await expect(
                service.updateStyle(
                    "style-1",
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

            const result = await service.updateStyle(
                "style-1",
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

    describe("listStyles", () => {
        it("lists only the user's styles by default", async () => {
            mockGet.mockResolvedValue({ docs: [makeDocSnap(baseData())] });
            const result = await service.listStyles("owner-1");
            expect(result).toHaveLength(1);
            expect(mockWhere).toHaveBeenCalledWith("userId", "==", "owner-1");
        });

        it("queries sharedWithEmails for tab=shared", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listStyles(
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
            await service.listStyles("any-user", undefined, "community");
            expect(mockWhere).toHaveBeenCalledWith("isTemplate", "==", true);
        });

        it("returns empty list for tab=shared when userEmail is absent", async () => {
            const result = await service.listStyles(
                "user-1",
                undefined,
                "shared",
            );
            expect(result).toEqual([]);
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe("updateStyle — isTemplate admin gate", () => {
        it("allows admin to set isTemplate=true", async () => {
            const snap = makeDocSnap(baseData());
            mockGet
                .mockResolvedValueOnce(snap)
                .mockResolvedValueOnce(
                    makeDocSnap({ ...baseData(), isTemplate: true }),
                );
            mockUpdate.mockResolvedValue(undefined);

            const result = await service.updateStyle(
                "style-1",
                "owner-1",
                { isTemplate: true },
                "admin@example.com",
            );
            expect(result.isTemplate).toBe(true);
        });

        it("rejects non-admin owner setting isTemplate=true", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));

            await expect(
                service.updateStyle(
                    "style-1",
                    "owner-1",
                    { isTemplate: true },
                    "owner@example.com",
                ),
            ).rejects.toThrow("Only admins can change template status");
        });

        it("allows no-op isTemplate update without admin check", async () => {
            const snap = makeDocSnap({ ...baseData(), isTemplate: false });
            mockGet.mockResolvedValueOnce(snap).mockResolvedValueOnce(snap);
            mockUpdate.mockResolvedValue(undefined);

            await expect(
                service.updateStyle(
                    "style-1",
                    "owner-1",
                    { isTemplate: false },
                    "owner@example.com",
                ),
            ).resolves.toBeDefined();
        });
    });

    describe("cloneStyle", () => {
        it("creates a new style owned by the caller", async () => {
            const original = makeDocSnap({
                ...baseData(),
                visibility: "public",
            });
            mockGet.mockResolvedValue(original);

            const cloneSnap = makeDocSnap(
                { ...baseData(), userId: "cloner-1", name: "Copy of My Style" },
                "style-clone-1",
            );
            mockAdd.mockResolvedValue({
                id: "style-clone-1",
                get: () => Promise.resolve(cloneSnap),
            });

            const cloned = await service.cloneStyle(
                "style-1",
                "cloner-1",
                "cloner@example.com",
            );

            expect(cloned.userId).toBe("cloner-1");
            expect(cloned.name).toBe("Copy of My Style");
            expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.STYLES);
        });
    });

    describe("createStyle", () => {
        it("creates a style with default sharing fields", async () => {
            const snap = makeDocSnap({
                ...baseData(),
                name: "New Style",
                visibility: "private",
                sharedWith: [],
                sharedWithEmails: [],
                isTemplate: false,
            });
            mockDoc.mockReturnValue({
                get: mockGet,
                update: mockUpdate,
                set: mockSet,
            });
            mockSet.mockResolvedValue(undefined);
            mockGet.mockResolvedValue(snap);

            const result = await service.createStyle("owner-1", {
                name: "New Style",
                description: "desc",
                content: "# content",
            });

            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: "owner-1",
                    visibility: "private",
                    sharedWith: [],
                    sharedWithEmails: [],
                    isTemplate: false,
                }),
            );
            expect(result.name).toBe("New Style");
        });
    });

    describe("deleteStyle", () => {
        it("deletes a style owned by the caller", async () => {
            const mockDelete = vi.fn().mockResolvedValue(undefined);
            mockDoc.mockReturnValue({
                get: mockGet,
                update: mockUpdate,
                set: mockSet,
                delete: mockDelete,
            });
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await service.deleteStyle("style-1", "owner-1");
            expect(mockDelete).toHaveBeenCalled();
        });

        it("throws Forbidden when non-owner tries to delete", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await expect(
                service.deleteStyle("style-1", "stranger"),
            ).rejects.toThrow("Forbidden");
        });
    });
});
