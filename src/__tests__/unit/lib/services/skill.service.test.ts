import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    SkillService,
    SkillNotFoundError,
    SkillForbiddenError,
} from "@/lib/services/skill.service";
import { COLLECTIONS } from "@/lib/constants";

// Mock Firestore
const { mockCollection, mockDoc, mockGet, mockSet, mockUpdate, mockDelete } =
    vi.hoisted(() => ({
        mockCollection: vi.fn(),
        mockDoc: vi.fn(),
        mockGet: vi.fn(),
        mockSet: vi.fn(),
        mockUpdate: vi.fn(),
        mockDelete: vi.fn(),
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

vi.mock("@/lib/config", () => ({
    config: {
        ADMIN_EMAILS: "admin@example.com",
    },
}));

describe("SkillService", () => {
    let skillService: SkillService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCollection.mockReturnValue({
            doc: mockDoc,
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            get: mockGet,
        });
        mockDoc.mockReturnValue({
            get: mockGet,
            set: mockSet,
            update: mockUpdate,
            delete: mockDelete,
        });

        skillService = new SkillService();
    });

    describe("listSkills", () => {
        it("should list skills for a user", async () => {
            const mockSkills = [
                {
                    id: "test-skill",
                    data: () => ({
                        userId: "user-1",
                        name: "test-skill",
                        description: "A test skill description",
                        instructions: "Use this skill to run tests.",
                        visibility: "private",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }),
                },
            ];

            mockGet.mockResolvedValueOnce({ docs: mockSkills });

            const result = await skillService.listSkills("user-1");

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("test-skill");
            expect(mockCollection).toHaveBeenCalledWith(
                COLLECTIONS.USER_SKILLS,
            );
        });

        it("should list shared skills when tab is shared and userEmail is provided", async () => {
            const mockSharedSkills = [
                {
                    id: "shared-skill",
                    data: () => ({
                        userId: "user-2",
                        name: "shared-skill",
                        visibility: "private",
                        sharedWithEmails: ["user1@example.com"],
                        updatedAt: "2026-06-25T13:00:00Z",
                    }),
                },
            ];

            mockGet.mockResolvedValueOnce({ docs: mockSharedSkills });

            const result = await skillService.listSkills(
                "user-1",
                "user1@example.com",
                "shared",
            );

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("shared-skill");
        });
    });

    describe("getSkill", () => {
        it("should get an owned skill", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                id: "test-skill",
                data: () => ({
                    userId: "user-1",
                    name: "test-skill",
                    visibility: "private",
                    sharedWithEmails: [],
                }),
            });

            const result = await skillService.getSkill("test-skill", "user-1");
            expect(result.id).toBe("test-skill");
        });

        it("should throw SkillNotFoundError if skill does not exist", async () => {
            mockGet.mockResolvedValue({ exists: false });

            await expect(
                skillService.getSkill("test-skill", "user-1"),
            ).rejects.toThrow(SkillNotFoundError);
        });

        it("should allow viewing a public skill even if not owner", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                id: "public-skill",
                data: () => ({
                    userId: "user-2",
                    name: "public-skill",
                    visibility: "public",
                    sharedWithEmails: [],
                }),
            });

            const result = await skillService.getSkill(
                "public-skill",
                "user-1",
            );
            expect(result.id).toBe("public-skill");
        });

        it("should allow viewing a shared skill if user email matches", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                id: "shared-skill",
                data: () => ({
                    userId: "user-2",
                    name: "shared-skill",
                    visibility: "private",
                    sharedWithEmails: ["user1@example.com"],
                }),
            });

            const result = await skillService.getSkill(
                "shared-skill",
                "user-1",
                "user1@example.com",
            );
            expect(result.id).toBe("shared-skill");
        });

        it("should throw SkillForbiddenError if unauthorized", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                id: "private-skill",
                data: () => ({
                    userId: "user-2",
                    name: "private-skill",
                    visibility: "private",
                    sharedWithEmails: [],
                }),
            });

            await expect(
                skillService.getSkill("private-skill", "user-1"),
            ).rejects.toThrow(SkillForbiddenError);
        });
    });

    describe("createSkill", () => {
        it("should create a new skill in kebab-case", async () => {
            mockGet.mockResolvedValueOnce({ exists: false }); // check existing
            mockGet.mockResolvedValueOnce({
                exists: true,
                id: "cyber-punk-campaign",
                data: () => ({
                    userId: "user-1",
                    name: "cyber-punk-campaign",
                }),
            });

            const result = await skillService.createSkill("user-1", {
                name: "Cyber Punk Campaign!",
                description: "A cyberpunk campaign workflow definition",
                instructions: "### Phase 1\nGenerate cyberpunk image",
            });

            expect(result.id).toBe("cyber-punk-campaign");
            expect(mockSet).toHaveBeenCalled();
        });

        it("should throw an error if skill already exists", async () => {
            mockGet.mockResolvedValue({ exists: true });

            await expect(
                skillService.createSkill("user-1", {
                    name: "existing-skill",
                    description: "existing desc",
                    instructions: "Use this skill.",
                }),
            ).rejects.toThrow(
                "Skill with name 'existing-skill' already exists.",
            );
        });
    });

    describe("updateSkill", () => {
        it("should allow owner to update their skill", async () => {
            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    userId: "user-1",
                    visibility: "private",
                    sharedWith: [],
                }),
            });
            mockGet.mockResolvedValueOnce({
                exists: true,
                id: "my-skill",
                data: () => ({
                    userId: "user-1",
                    name: "my-skill",
                    description: "Updated description",
                }),
            });

            const result = await skillService.updateSkill(
                "my-skill",
                "user-1",
                {
                    description: "Updated description",
                },
            );

            expect(result.description).toBe("Updated description");
            expect(mockUpdate).toHaveBeenCalled();
        });

        it("should allow editor to update skill content", async () => {
            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    userId: "user-2",
                    visibility: "private",
                    sharedWith: [{ email: "editor@example.com", role: "edit" }],
                }),
            });
            mockGet.mockResolvedValueOnce({
                exists: true,
                id: "shared-skill",
                data: () => ({
                    userId: "user-2",
                    name: "shared-skill",
                    description: "Editor updated this",
                }),
            });

            const result = await skillService.updateSkill(
                "shared-skill",
                "user-1",
                { description: "Editor updated this" },
                "editor@example.com",
            );

            expect(result.description).toBe("Editor updated this");
            expect(mockUpdate).toHaveBeenCalled();
        });

        it("should throw error if non-owner tries to update visibility", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    userId: "user-2",
                    visibility: "private",
                    sharedWith: [{ email: "editor@example.com", role: "edit" }],
                }),
            });

            await expect(
                skillService.updateSkill(
                    "shared-skill",
                    "user-1",
                    { visibility: "public" },
                    "editor@example.com",
                ),
            ).rejects.toThrow("Only the owner can change sharing settings");
        });

        it("should throw error if non-admin tries to make a skill a template", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    userId: "user-1",
                    isTemplate: false,
                    sharedWith: [],
                }),
            });

            await expect(
                skillService.updateSkill(
                    "my-skill",
                    "user-1",
                    { isTemplate: true },
                    "user@example.com", // not admin
                ),
            ).rejects.toThrow("Only admins can change template status");
        });
    });

    describe("deleteSkill", () => {
        it("should allow owner to delete a skill", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    userId: "user-1",
                }),
            });

            await skillService.deleteSkill("my-skill", "user-1");
            expect(mockDelete).toHaveBeenCalled();
        });

        it("should throw error if non-owner tries to delete", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    userId: "user-2",
                }),
            });

            await expect(
                skillService.deleteSkill("my-skill", "user-1"),
            ).rejects.toThrow(SkillForbiddenError);
        });
    });

    describe("cloneSkill", () => {
        it("should clone a skill and append copy-of- prefix", async () => {
            mockGet.mockResolvedValueOnce({
                exists: true,
                id: "original-skill",
                data: () => ({
                    userId: "user-2",
                    name: "original-skill",
                    description: "Original description",
                    instructions: "Use original instructions.",
                    visibility: "public",
                    sharedWithEmails: [],
                }),
            }); // getSkill

            mockGet.mockResolvedValueOnce({ exists: false }); // unique check for copy-of-original-skill
            mockGet.mockResolvedValueOnce({
                exists: true,
                id: "copy-of-original-skill",
                data: () => ({
                    userId: "user-1",
                    name: "copy-of-original-skill",
                    description: "Original description",
                }),
            }); // final transformed doc retrieval

            const result = await skillService.cloneSkill(
                "original-skill",
                "user-1",
            );

            expect(result.id).toBe("copy-of-original-skill");
            expect(mockSet).toHaveBeenCalled();
        });
    });
});
