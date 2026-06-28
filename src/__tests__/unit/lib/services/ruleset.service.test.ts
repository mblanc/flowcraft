import { describe, it, expect, vi, beforeEach } from "vitest";
import { RulesetService } from "@/lib/services/ruleset.service";
import { COLLECTIONS } from "@/lib/constants";

const {
    mockCollection,
    mockDoc,
    mockGet,
    mockSet,
    mockUpdate,
    mockDelete,
    mockWhere,
} = vi.hoisted(() => ({
    mockCollection: vi.fn(),
    mockDoc: vi.fn(),
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
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

const baseData = () => ({
    userId: "owner-1",
    name: "Brand Rules",
    description: "Our brand guidelines",
    rules: [
        {
            id: "rule-1",
            description: "Logo in top-right",
            severity: "hard",
            failureStrategy: "surface",
        },
    ],
    visibility: "private",
    sharedWith: [],
    sharedWithEmails: [],
    createdAt: new Date(),
    updatedAt: new Date(),
});

function makeDocSnap(data: Record<string, unknown>, id = "ruleset-1") {
    return { exists: true, id, data: () => data };
}

describe("RulesetService", () => {
    let service: RulesetService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockWhere.mockReturnThis();

        mockCollection.mockReturnValue({
            doc: mockDoc,
            where: mockWhere,
            orderBy: vi.fn().mockReturnThis(),
            get: mockGet,
        });

        mockDoc.mockReturnValue({
            get: mockGet,
            set: mockSet,
            update: mockUpdate,
            delete: mockDelete,
        });

        service = new RulesetService();
    });

    describe("listRulesets", () => {
        it("lists the user's own rulesets by default", async () => {
            mockGet.mockResolvedValue({ docs: [makeDocSnap(baseData())] });
            const result = await service.listRulesets("owner-1");
            expect(result).toHaveLength(1);
            expect(mockWhere).toHaveBeenCalledWith("userId", "==", "owner-1");
        });

        it("queries sharedWithEmails for tab=shared", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listRulesets("other", "viewer@example.com", "shared");
            expect(mockWhere).toHaveBeenCalledWith(
                "sharedWithEmails",
                "array-contains",
                "viewer@example.com",
            );
        });

        it("queries visibility=public for tab=community", async () => {
            mockGet.mockResolvedValue({ docs: [] });
            await service.listRulesets("any", undefined, "community");
            expect(mockWhere).toHaveBeenCalledWith(
                "visibility",
                "==",
                "public",
            );
        });

        it("returns empty list for tab=shared when userEmail is absent", async () => {
            const result = await service.listRulesets(
                "user-1",
                undefined,
                "shared",
            );
            expect(result).toEqual([]);
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe("getRuleset", () => {
        it("allows the owner", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            const ruleset = await service.getRuleset("ruleset-1", "owner-1");
            expect(ruleset.id).toBe("ruleset-1");
        });

        it("allows a user in sharedWithEmails", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({
                    ...baseData(),
                    sharedWithEmails: ["viewer@example.com"],
                }),
            );
            const ruleset = await service.getRuleset(
                "ruleset-1",
                "other-user",
                "viewer@example.com",
            );
            expect(ruleset.id).toBe("ruleset-1");
        });

        it("allows any user when visibility is public", async () => {
            mockGet.mockResolvedValue(
                makeDocSnap({ ...baseData(), visibility: "public" }),
            );
            const ruleset = await service.getRuleset(
                "ruleset-1",
                "random-user",
                "random@example.com",
            );
            expect(ruleset.id).toBe("ruleset-1");
        });

        it("rejects a non-owner on a private ruleset", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await expect(
                service.getRuleset(
                    "ruleset-1",
                    "other-user",
                    "other@example.com",
                ),
            ).rejects.toThrow("Forbidden");
        });

        it("throws when ruleset does not exist", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "ruleset-1",
                data: () => undefined,
            });
            await expect(
                service.getRuleset("ruleset-1", "owner-1"),
            ).rejects.toThrow("Ruleset not found");
        });
    });

    describe("createRuleset", () => {
        it("creates a ruleset with default sharing fields", async () => {
            const snap = makeDocSnap({ ...baseData(), name: "New Rules" });
            mockSet.mockResolvedValue(undefined);
            mockGet.mockResolvedValue(snap);

            const result = await service.createRuleset("owner-1", {
                name: "New Rules",
            });

            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: "owner-1",
                    visibility: "private",
                    sharedWith: [],
                    sharedWithEmails: [],
                }),
            );
            expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.RULESETS);
            expect(result.name).toBe("New Rules");
        });

        it("syncs sharedWithEmails from sharedWith on create", async () => {
            const snap = makeDocSnap(baseData());
            mockSet.mockResolvedValue(undefined);
            mockGet.mockResolvedValue(snap);

            await service.createRuleset("owner-1", {
                name: "Shared Rules",
                sharedWith: [{ email: "a@b.com", role: "view" }],
            });

            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    sharedWithEmails: ["a@b.com"],
                }),
            );
        });
    });

    describe("updateRuleset", () => {
        it("updates a ruleset owned by the caller", async () => {
            const snap = makeDocSnap(baseData());
            const updatedSnap = makeDocSnap({ ...baseData(), name: "Updated" });
            mockGet
                .mockResolvedValueOnce(snap)
                .mockResolvedValueOnce(updatedSnap);
            mockUpdate.mockResolvedValue(undefined);

            const result = await service.updateRuleset("ruleset-1", "owner-1", {
                name: "Updated",
            });

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ name: "Updated" }),
            );
            expect(result.name).toBe("Updated");
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

            await service.updateRuleset("ruleset-1", "owner-1", {
                sharedWith: [{ email: "a@b.com", role: "view" }],
            });

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ sharedWithEmails: ["a@b.com"] }),
            );
        });

        it("rejects a non-owner trying to update", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await expect(
                service.updateRuleset("ruleset-1", "stranger", {
                    name: "Hack",
                }),
            ).rejects.toThrow("Forbidden");
        });

        it("throws when ruleset does not exist", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "ruleset-1",
                data: () => undefined,
            });
            await expect(
                service.updateRuleset("ruleset-1", "owner-1", { name: "X" }),
            ).rejects.toThrow("Ruleset not found");
        });
    });

    describe("deleteRuleset", () => {
        it("deletes a ruleset owned by the caller", async () => {
            mockDelete.mockResolvedValue(undefined);
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await service.deleteRuleset("ruleset-1", "owner-1");
            expect(mockDelete).toHaveBeenCalled();
        });

        it("throws Forbidden when non-owner tries to delete", async () => {
            mockGet.mockResolvedValue(makeDocSnap(baseData()));
            await expect(
                service.deleteRuleset("ruleset-1", "stranger"),
            ).rejects.toThrow("Forbidden");
        });

        it("throws when ruleset does not exist", async () => {
            mockGet.mockResolvedValue({
                exists: false,
                id: "ruleset-1",
                data: () => undefined,
            });
            await expect(
                service.deleteRuleset("ruleset-1", "owner-1"),
            ).rejects.toThrow("Ruleset not found");
        });
    });
});
