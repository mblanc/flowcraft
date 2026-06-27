import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import type {
    CanvasDocument,
    CanvasNode,
    ChatMessage,
} from "@/lib/canvas/types";

const baseCanvas: CanvasDocument = {
    id: "c1",
    userId: "u1",
    name: "Test Canvas",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    messages: [],
    visibility: "private",
    sharedWith: [],
    sharedWithEmails: [],
    isTemplate: false,
    createdAt: "",
    updatedAt: "",
};

const makeNode = (id: string): CanvasNode => ({
    id,
    type: "canvas-image",
    position: { x: 0, y: 0 },
    data: {
        type: "canvas-image",
        label: "Image",
        sourceUrl: "",
        mimeType: "image/png",
        width: 512,
        height: 512,
        status: "ready",
    },
});

const makeMessage = (id: string): ChatMessage => ({
    id,
    role: "user",
    content: "hello",
    createdAt: new Date().toISOString(),
});

function resetStore() {
    useCanvasStore.setState({
        canvasId: null,
        canvasUserId: null,
        canvasName: "Untitled Canvas",
        canvasVisibility: "private",
        canvasSharedWith: [],
        canvasIsTemplate: false,
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        messages: [],
        activeStyleId: null,
        selectedNodeIds: [],
        isSaving: false,
        saveStatus: "saved",
        isChatLoading: false,
        generatingNodeIds: [],
        pendingActionPrompt: null,
        planStepStatuses: {},
        lastModified: 0,
    });
}

describe("useCanvasStore", () => {
    beforeEach(() => {
        resetStore();
    });

    describe("setCanvas", () => {
        it("populates all canvas fields from a CanvasDocument", () => {
            const canvas: CanvasDocument = {
                ...baseCanvas,
                id: "c2",
                userId: "u2",
                name: "My Canvas",
                visibility: "public",
                isTemplate: true,
            };
            useCanvasStore.getState().setCanvas(canvas);
            const s = useCanvasStore.getState();
            expect(s.canvasId).toBe("c2");
            expect(s.canvasUserId).toBe("u2");
            expect(s.canvasName).toBe("My Canvas");
            expect(s.canvasVisibility).toBe("public");
            expect(s.canvasIsTemplate).toBe(true);
        });
    });

    describe("setCanvasName", () => {
        it("updates canvasName and bumps lastModified", () => {
            useCanvasStore.getState().setCanvasName("New Name");
            const s = useCanvasStore.getState();
            expect(s.canvasName).toBe("New Name");
            expect(s.lastModified).toBeGreaterThan(0);
        });
    });

    describe("addNode", () => {
        it("appends a node to the list", () => {
            useCanvasStore.getState().addNode(makeNode("n1"));
            expect(useCanvasStore.getState().nodes).toHaveLength(1);
            expect(useCanvasStore.getState().nodes[0].id).toBe("n1");
        });
    });

    describe("removeNode", () => {
        it("removes a node by id", () => {
            useCanvasStore.getState().addNode(makeNode("n1"));
            useCanvasStore.getState().addNode(makeNode("n2"));
            useCanvasStore.getState().removeNode("n1");
            const ids = useCanvasStore.getState().nodes.map((n) => n.id);
            expect(ids).toEqual(["n2"]);
        });
    });

    describe("updateNode", () => {
        it("merges data into an existing node", () => {
            useCanvasStore.getState().addNode(makeNode("n1"));
            useCanvasStore.getState().updateNode("n1", {
                type: "canvas-video",
            } as Partial<CanvasNode>);
            expect(useCanvasStore.getState().nodes[0].type).toBe(
                "canvas-video",
            );
        });
    });

    describe("updateNodeData", () => {
        it("merges data fields into the node data object", () => {
            useCanvasStore.getState().addNode(makeNode("n1"));
            useCanvasStore
                .getState()
                .updateNodeData("n1", { status: "generating" });
            expect(
                (useCanvasStore.getState().nodes[0].data as { status: string })
                    .status,
            ).toBe("generating");
        });
    });

    describe("removeSelectedNodes", () => {
        it("removes all currently selected nodes", () => {
            useCanvasStore.getState().addNode(makeNode("n1"));
            useCanvasStore.getState().addNode(makeNode("n2"));
            useCanvasStore.getState().setSelectedNodeIds(["n1"]);
            useCanvasStore.getState().removeSelectedNodes();
            expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual([
                "n2",
            ]);
        });
    });

    describe("setNodes", () => {
        it("replaces all nodes", () => {
            useCanvasStore.getState().addNode(makeNode("n1"));
            useCanvasStore
                .getState()
                .setNodes([makeNode("n2"), makeNode("n3")]);
            expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual([
                "n2",
                "n3",
            ]);
        });
    });

    describe("setViewport", () => {
        it("updates viewport", () => {
            useCanvasStore.getState().setViewport({ x: 100, y: 200, zoom: 2 });
            expect(useCanvasStore.getState().viewport).toEqual({
                x: 100,
                y: 200,
                zoom: 2,
            });
        });
    });

    describe("messages", () => {
        it("addMessage appends a message", () => {
            useCanvasStore.getState().addMessage(makeMessage("m1"));
            expect(useCanvasStore.getState().messages).toHaveLength(1);
        });

        it("updateMessage patches an existing message", () => {
            useCanvasStore.getState().addMessage(makeMessage("m1"));
            useCanvasStore
                .getState()
                .updateMessage("m1", { content: "updated" });
            expect(useCanvasStore.getState().messages[0].content).toBe(
                "updated",
            );
        });

        it("clearMessages empties the list", () => {
            useCanvasStore.getState().addMessage(makeMessage("m1"));
            useCanvasStore.getState().clearMessages();
            expect(useCanvasStore.getState().messages).toHaveLength(0);
        });
    });

    describe("save status", () => {
        it("setSaveStatus updates saveStatus", () => {
            useCanvasStore.getState().setSaveStatus("saving");
            expect(useCanvasStore.getState().saveStatus).toBe("saving");
        });
    });

    describe("generatingNodeIds", () => {
        it("addGeneratingNodeId adds an id", () => {
            useCanvasStore.getState().addGeneratingNodeId("n1");
            expect(useCanvasStore.getState().generatingNodeIds).toContain("n1");
        });

        it("removeGeneratingNodeId removes an id", () => {
            useCanvasStore.getState().addGeneratingNodeId("n1");
            useCanvasStore.getState().removeGeneratingNodeId("n1");
            expect(useCanvasStore.getState().generatingNodeIds).not.toContain(
                "n1",
            );
        });
    });

    describe("setActiveStyleId", () => {
        it("sets and clears activeStyleId", () => {
            useCanvasStore.getState().setActiveStyleId("style-1");
            expect(useCanvasStore.getState().activeStyleId).toBe("style-1");
            useCanvasStore.getState().setActiveStyleId(null);
            expect(useCanvasStore.getState().activeStyleId).toBeNull();
        });
    });

    describe("setIsChatLoading", () => {
        it("sets loading state", () => {
            useCanvasStore.getState().setIsChatLoading(true);
            expect(useCanvasStore.getState().isChatLoading).toBe(true);
        });
    });

    describe("setPendingActionPrompt", () => {
        it("sets and clears pending prompt", () => {
            useCanvasStore.getState().setPendingActionPrompt("run this");
            expect(useCanvasStore.getState().pendingActionPrompt).toBe(
                "run this",
            );
            useCanvasStore.getState().setPendingActionPrompt(null);
            expect(useCanvasStore.getState().pendingActionPrompt).toBeNull();
        });
    });

    describe("getNextLabel / getNextNodeId", () => {
        it("returns label with counter suffix", () => {
            const label = useCanvasStore
                .getState()
                .getNextLabel("canvas-image");
            expect(label).toMatch(/Image \d+/);
        });

        it("returns a higher index after adding a node", () => {
            const id1 = useCanvasStore.getState().getNextNodeId("canvas-video");
            const node = {
                ...makeNode(id1),
                type: "canvas-video" as const,
                id: id1,
            };
            useCanvasStore.getState().addNode(node);
            const id2 = useCanvasStore.getState().getNextNodeId("canvas-video");
            expect(id1).not.toBe(id2);
        });
    });
});
