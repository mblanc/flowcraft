
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowService } from "../lib/services/flow.service";
import { COLLECTIONS } from "../lib/constants";
import * as graphUtils from "../lib/graph-utils";

// Mock Firestore
const { mockCollection, mockDoc, mockGet, mockAdd, mockUpdate } = vi.hoisted(() => ({
    mockCollection: vi.fn(),
    mockDoc: vi.fn(),
    mockGet: vi.fn(),
    mockAdd: vi.fn(),
    mockUpdate: vi.fn(),
}));

vi.mock("@/lib/firestore", () => ({
    getFirestore: () => ({
        collection: mockCollection,
    }),
}));

vi.mock("@/lib/graph-utils", async () => {
    const actual = await vi.importActual<typeof graphUtils>("../lib/graph-utils");
    return {
        ...actual,
        detectRecursiveCycle: vi.fn(),
    };
});

describe("FlowService - Publish Flow", () => {
    let flowService: FlowService;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup Firestore mocks
        const mockCount = vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
                data: () => ({ count: 0 })
            })
        });

        mockCollection.mockReturnValue({
            doc: mockDoc,
            add: mockAdd,
            count: mockCount, // Support count() query
        });
        mockDoc.mockReturnValue({
            get: mockGet,
            collection: mockCollection, // For subcollections
            update: mockUpdate,
        });

        flowService = new FlowService();
    });

    it("should throw error if flow not found", async () => {
        mockGet.mockResolvedValue({ exists: false });

        await expect(flowService.publishFlow("flow-1", "user-1")).rejects.toThrow("Flow not found");
    });

    it("should throw error if unauthorized", async () => {
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: "other-user" }),
            id: "flow-1",
        });

        await expect(flowService.publishFlow("flow-1", "user-1")).rejects.toThrow("Unauthorized");
    });

    it("should throw error if flow has no input/output nodes", async () => {
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: "user-1", nodes: [], edges: [] }),
            id: "flow-1",
        });

        await expect(flowService.publishFlow("flow-1", "user-1")).rejects.toThrow(
            "Flow must have at least one Workflow Input and one Workflow Output node"
        );
    });

    it("should throw error if flow has a cycle", async () => {
        const nodes = [
            { id: "in", type: "workflow-input" }, 
            { id: "out", type: "workflow-output" },
            { id: "1" }, 
            { id: "2" }
        ];
        const edges = [{ source: "1", target: "2" }, { source: "2", target: "1" }];
        
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: "user-1", nodes, edges }),
            id: "flow-1",
        });

        await expect(flowService.publishFlow("flow-1", "user-1")).rejects.toThrow(
            "Flow contains a cycle"
        );
    });

    it("should throw error if recursive cycle detected", async () => {
         const nodes = [
             { id: "1", type: "workflow-input" },
             { id: "2", type: "workflow-output" },
             { id: "3", type: "custom-workflow", data: { subWorkflowId: "sub-1" } }
         ];
         
         mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: "user-1", nodes, edges: [] }),
            id: "flow-1",
        });

        // Mock detectRecursiveCycle to return true
        vi.mocked(graphUtils.detectRecursiveCycle).mockResolvedValue(true);

        await expect(flowService.publishFlow("flow-1", "user-1")).rejects.toThrow(
            "Recursive cycle detected"
        );
    });

    it("should publish flow successfully", async () => {
         const nodes = [
             { id: "1", type: "workflow-input" },
             { id: "2", type: "workflow-output" }
         ];
         
         mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ userId: "user-1", nodes, edges: [], version: "1.0.0" }),
            id: "flow-1",
        });

        mockAdd.mockResolvedValue({ id: "version-id" });

        vi.mocked(graphUtils.detectRecursiveCycle).mockResolvedValue(false);

        const result = await flowService.publishFlow("flow-1", "user-1");

        expect(result.version).toBeDefined();
        // Check if added to versions collection
        expect(mockCollection).toHaveBeenCalledWith(COLLECTIONS.FLOWS);
        expect(mockDoc).toHaveBeenCalledWith("flow-1");
        expect(mockCollection).toHaveBeenCalledWith("versions"); // subcollection
        
        // Check update
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            isPublished: true,
            publishedVersion: expect.any(String),
        }));
    });
});
