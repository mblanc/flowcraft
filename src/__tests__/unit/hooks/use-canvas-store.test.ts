import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "@/lib/store/use-canvas-store";

describe("useCanvasStore", () => {
    beforeEach(() => {
        useCanvasStore.setState({
            canvasId: null,
            canvasName: "Untitled Canvas",
            nodes: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            messages: [],
            selectedNodeIds: [],
            isSaving: false,
            saveStatus: "saved",
            isChatLoading: false,
            generatingNodeIds: [],
            pendingActionPrompt: null,
            planStepStatuses: {},
            lastModified: 0,
        });
    });

    it("should initialize with default state", () => {
        const state = useCanvasStore.getState();
        expect(state.messages).toEqual([]);
    });

    it("addNode creates a canvas-text node with format", () => {
        useCanvasStore.getState().addNode({
            id: "txt_01",
            type: "canvas-text",
            position: { x: 100, y: 200 },
            data: {
                type: "canvas-text",
                label: "Lumino — Trailer Architecture",
                content: "# Lumino\n\nShot 01 — The Watcher...",
                format: "scenario",
                width: 480,
                height: 600,
            },
            width: 480,
            height: 600,
        });
        const nodes = useCanvasStore.getState().nodes;
        expect(nodes).toHaveLength(1);
        expect(nodes[0].type).toBe("canvas-text");
        const d = nodes[0].data as { label: string; format?: string };
        expect(d.label).toBe("Lumino — Trailer Architecture");
        expect(d.format).toBe("scenario");
    });

    it("addNode for multiple text nodes stacks them correctly when positioned by caller", () => {
        const nodeHeight = 600;
        const gap = 40;
        [0, 1].forEach((idx) => {
            useCanvasStore.getState().addNode({
                id: `txt_0${idx}`,
                type: "canvas-text",
                position: { x: 100, y: 200 + idx * (nodeHeight + gap) },
                data: {
                    type: "canvas-text",
                    label: `Node ${idx}`,
                    content: "content",
                    width: 480,
                    height: 600,
                },
                width: 480,
                height: 600,
            });
        });
        const nodes = useCanvasStore.getState().nodes;
        expect(nodes).toHaveLength(2);
        expect(nodes[1].position.y).toBeGreaterThan(nodes[0].position.y);
    });

    it("should clear messages", () => {
        useCanvasStore.setState({
            messages: [
                {
                    id: "1",
                    role: "user",
                    content: "hello",
                    createdAt: new Date().toISOString(),
                },
            ],
        });

        expect(useCanvasStore.getState().messages.length).toBe(1);

        useCanvasStore.getState().clearMessages();

        expect(useCanvasStore.getState().messages).toEqual([]);
        expect(useCanvasStore.getState().lastModified).toBeGreaterThan(0);
    });
});
