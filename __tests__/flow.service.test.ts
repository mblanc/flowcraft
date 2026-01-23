import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowService } from "../lib/services/flow.service";
import { COLLECTIONS } from "../lib/constants";

// Mock Firestore
const { mockCollection, mockDoc, mockGet, mockAdd, mockUpdate, mockDelete } =
    vi.hoisted(() => ({
        mockCollection: vi.fn(),
        mockDoc: vi.fn(),
        mockGet: vi.fn(),
        mockAdd: vi.fn(),
        mockUpdate: vi.fn(),
        mockDelete: vi.fn(),
    }));

vi.mock("@/lib/firestore", () => ({
    getFirestore: () => ({
        collection: mockCollection,
    }),
}));

describe("FlowService", () => {
    let flowService: FlowService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCollection.mockReturnValue({
            doc: mockDoc,
            add: mockAdd,
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            get: mockGet,
        });
        mockDoc.mockReturnValue({
            get: mockGet,
            update: mockUpdate,
            delete: mockDelete,
        });

        flowService = new FlowService();
    });

    describe("listFlows", () => {
        it("should list flows for a user", async () => {
            const mockFlows = [
                {
                    id: "flow-1",
                    data: () => ({
                        userId: "user-1",
                        name: "Test Flow",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }),
                },
            ];

            mockGet.mockResolvedValue({ docs: mockFlows });

            const result = await flowService.listFlows("user-1");

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("flow-1");
            expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.FLOWS);
        });
    });

    describe("getFlow", () => {
        it("should get a flow by ID", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                id: "flow-1",
                data: () => ({
                    userId: "user-1",
                    name: "Test Flow",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
            });

            const result = await flowService.getFlow("flow-1", "user-1");

            expect(result.id).toBe("flow-1");
            expect(result.name).toBe("Test Flow");
        });

        it("should throw error if flow not found", async () => {
            mockGet.mockResolvedValue({ exists: false });

            await expect(
                flowService.getFlow("flow-1", "user-1"),
            ).rejects.toThrow("Flow not found");
        });

        it("should throw error if unauthorized", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                id: "flow-1",
                data: () => ({ userId: "other-user" }),
            });

            await expect(
                flowService.getFlow("flow-1", "user-1"),
            ).rejects.toThrow("Unauthorized");
        });
    });

    describe("createFlow", () => {
        it("should create a new flow", async () => {
            mockAdd.mockResolvedValue({ id: "new-flow-id" });

            const result = await flowService.createFlow("user-1", {
                name: "New Flow",
                nodes: [],
                edges: [],
            });

            expect(result.id).toBe("new-flow-id");
            expect(result.name).toBe("New Flow");
            expect(mockAdd).toHaveBeenCalled();
        });
    });

    describe("updateFlow", () => {
        it("should update an existing flow", async () => {
            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ userId: "user-1" }),
            });
            mockGet.mockResolvedValueOnce({
                exists: true,
                id: "flow-1",
                data: () => ({
                    userId: "user-1",
                    name: "Updated Flow",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
            });

            const result = await flowService.updateFlow("flow-1", "user-1", {
                name: "Updated Flow",
            });

            expect(result.name).toBe("Updated Flow");
            expect(mockUpdate).toHaveBeenCalled();
        });

        it("should throw error if flow not found", async () => {
            mockGet.mockResolvedValue({ exists: false });

            await expect(
                flowService.updateFlow("flow-1", "user-1", {
                    name: "Updated",
                }),
            ).rejects.toThrow("Flow not found");
        });

        it("should throw error if unauthorized", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({ userId: "other-user" }),
            });

            await expect(
                flowService.updateFlow("flow-1", "user-1", {
                    name: "Updated",
                }),
            ).rejects.toThrow("Unauthorized");
        });
    });

    describe("deleteFlow", () => {
        it("should delete a flow", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({ userId: "user-1" }),
            });

            const result = await flowService.deleteFlow("flow-1", "user-1");

            expect(result.success).toBe(true);
            expect(mockDelete).toHaveBeenCalled();
        });

        it("should throw error if flow not found", async () => {
            mockGet.mockResolvedValue({ exists: false });

            await expect(
                flowService.deleteFlow("flow-1", "user-1"),
            ).rejects.toThrow("Flow not found");
        });

        it("should throw error if unauthorized", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({ userId: "other-user" }),
            });

            await expect(
                flowService.deleteFlow("flow-1", "user-1"),
            ).rejects.toThrow("Unauthorized");
        });
    });
});
