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
