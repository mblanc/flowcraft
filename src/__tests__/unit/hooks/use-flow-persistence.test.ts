import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    type Mock,
} from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlowPersistence } from "@/hooks/use-flow-persistence";
import { useFlowStore } from "@/lib/store/use-flow-store";

// Shared store reset — mirrors the shape used in use-flow-store.test.ts
function resetStore(
    overrides: Partial<ReturnType<typeof useFlowStore.getState>> = {},
) {
    useFlowStore.setState({
        nodes: [],
        nodesById: {},
        edges: [],
        selectedNodeId: null,
        selectedNode: null,
        flowId: null,
        flowName: "Test Flow",
        entityType: "flow",
        visibility: null,
        sharedWith: [],
        isTemplate: false,
        ownerId: null,
        lastModified: 0,
        saveStatus: "saved",
        isConfigSidebarOpen: false,
        ...overrides,
    });
}

// The vitest setup mocks useSession → user.id = "test-user-id"
const OWNER_ID = "test-user-id";

describe("useFlowPersistence — saveFlow status transitions", () => {
    beforeEach(() => {
        resetStore({ flowId: "flow-1", ownerId: OWNER_ID });
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sets saveStatus to 'saving' then 'saved' on success", async () => {
        (fetch as Mock).mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).toHaveBeenCalledOnce();
        expect(useFlowStore.getState().saveStatus).toBe("saved");
    });

    it("sets saveStatus to 'error' when the server returns a non-ok response", async () => {
        (fetch as Mock).mockResolvedValue({ ok: false, status: 500 });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow().catch(() => undefined);
        });

        expect(useFlowStore.getState().saveStatus).toBe("error");
    });

    it("sets saveStatus to 'error' when fetch throws a network error", async () => {
        (fetch as Mock).mockRejectedValue(new Error("Network failure"));

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow().catch(() => undefined);
        });

        expect(useFlowStore.getState().saveStatus).toBe("error");
    });

    it("does not call fetch when flowId is null", async () => {
        resetStore({ flowId: null, ownerId: OWNER_ID });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).not.toHaveBeenCalled();
        // saveStatus stays at its initial value — no change
        expect(useFlowStore.getState().saveStatus).toBe("saved");
    });

    it("does not call fetch when user is not the owner and flow is not a template", async () => {
        resetStore({ flowId: "flow-1", ownerId: "someone-else" });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).not.toHaveBeenCalled();
    });

    it("calls the correct API path for a custom-node entity", async () => {
        resetStore({
            flowId: "node-1",
            ownerId: OWNER_ID,
            entityType: "custom-node",
        });
        (fetch as Mock).mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).toHaveBeenCalledWith(
            "/api/custom-nodes/node-1",
            expect.objectContaining({ method: "PUT" }),
        );
    });

    it("calls the correct API path for a flow entity", async () => {
        (fetch as Mock).mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).toHaveBeenCalledWith(
            "/api/flows/flow-1",
            expect.objectContaining({ method: "PUT" }),
        );
    });

    it("allows save when user is an editor (shared with edit role)", async () => {
        resetStore({
            flowId: "flow-1",
            ownerId: "other-owner",
            sharedWith: [{ email: "test@example.com", role: "edit" }],
        });
        (fetch as Mock).mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).toHaveBeenCalledOnce();
        expect(useFlowStore.getState().saveStatus).toBe("saved");
    });

    it("does not call fetch when user is not owner and flow is a template", async () => {
        resetStore({
            flowId: "flow-1",
            ownerId: "other-owner",
            isTemplate: true,
        });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).not.toHaveBeenCalled();
    });
});

describe("useFlowPersistence — auto-save via useAutoSave", () => {
    beforeEach(() => {
        resetStore({ flowId: "flow-1", ownerId: OWNER_ID, lastModified: 0 });
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("does not auto-save when lastModified is 0", () => {
        renderHook(() => useFlowPersistence());
        vi.advanceTimersByTime(3000);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("auto-saves after 2000ms debounce when lastModified is set", async () => {
        resetStore({
            flowId: "flow-1",
            ownerId: OWNER_ID,
            lastModified: Date.now(),
        });

        renderHook(() => useFlowPersistence());

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(fetch).toHaveBeenCalledOnce();
    });

    it("does not auto-save before the debounce window", () => {
        resetStore({
            flowId: "flow-1",
            ownerId: OWNER_ID,
            lastModified: Date.now(),
        });

        renderHook(() => useFlowPersistence());
        vi.advanceTimersByTime(1999);

        expect(fetch).not.toHaveBeenCalled();
    });
});

describe("useFlowPersistence — exportFlow", () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        resetStore({
            flowId: "flow-1",
            ownerId: OWNER_ID,
            flowName: "My Test Flow",
        });
        createObjectURLMock = vi.fn(() => "blob:mock-url");
        revokeObjectURLMock = vi.fn();
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            writable: true,
            value: createObjectURLMock,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            writable: true,
            value: revokeObjectURLMock,
        });
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("creates an anchor with the correct download filename", () => {
        const { result } = renderHook(() => useFlowPersistence());

        // Set up spy after renderHook so React's container div is not captured
        const appendSpy = vi.spyOn(document.body, "appendChild");

        act(() => {
            result.current.exportFlow();
        });

        expect(createObjectURLMock).toHaveBeenCalledOnce();
        const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
        expect(anchor.tagName).toBe("A");
        expect(anchor.download).toBe("my-test-flow.json");
    });

    it("revokes the object URL after 100ms", () => {
        const { result } = renderHook(() => useFlowPersistence());

        act(() => {
            result.current.exportFlow();
        });

        expect(revokeObjectURLMock).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
    });
});

describe("useFlowPersistence — importFlow", () => {
    beforeEach(() => {
        resetStore({ flowId: "flow-1", ownerId: OWNER_ID });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function renderAndCapture() {
        const { result } = renderHook(() => useFlowPersistence());

        let capturedInput: HTMLInputElement | null = null;
        const origCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(
            (tag: string): HTMLElement => {
                const el = (origCreate as (t: string) => HTMLElement)(tag);
                if (tag === "input") capturedInput = el as HTMLInputElement;
                return el;
            },
        );

        act(() => {
            result.current.importFlow();
        });

        return capturedInput!;
    }

    function triggerRead(input: HTMLInputElement, content: string) {
        const mockReader = {
            readAsText: vi.fn(),
            onload: null as
                | ((e: { target: { result: string } }) => void)
                | null,
        };
        // Must use a regular function (not arrow) — arrow functions cannot be constructors
        vi.stubGlobal(
            "FileReader",
            vi.fn(function MockReader() {
                return mockReader;
            }),
        );

        const file = new File([content], "flow.json", {
            type: "application/json",
        });
        act(() => {
            input.onchange!({ target: { files: [file] } } as unknown as Event);
        });
        act(() => {
            mockReader.onload?.({ target: { result: content } });
        });
    }

    it("sets nodes, edges, and name from a valid JSON file", () => {
        const mockNodes = [
            {
                id: "n1",
                type: "llm",
                position: { x: 0, y: 0 },
                data: {
                    type: "llm",
                    name: "LLM Node",
                    model: "gemini-pro",
                    instructions: "",
                },
            },
        ];
        const mockEdges = [
            {
                id: "e1",
                source: "n1",
                target: "n2",
                sourceHandle: null,
                targetHandle: null,
            },
        ];
        const flowData = {
            name: "Imported Flow",
            nodes: mockNodes,
            edges: mockEdges,
        };

        const input = renderAndCapture();
        triggerRead(input, JSON.stringify(flowData));

        const state = useFlowStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(state.nodes[0]).toEqual(expect.objectContaining({ id: "n1" }));
        expect(state.edges).toEqual(mockEdges);
        expect(state.flowName).toBe("Imported Flow");
    });

    it("updates nodes and edges but leaves name unchanged when JSON has no name", () => {
        const mockNodes = [
            {
                id: "n1",
                type: "llm",
                position: { x: 0, y: 0 },
                data: {
                    type: "llm",
                    name: "LLM Node",
                    model: "gemini-pro",
                    instructions: "",
                },
            },
        ];
        const flowData = { nodes: mockNodes, edges: [] };

        const input = renderAndCapture();
        triggerRead(input, JSON.stringify(flowData));

        expect(useFlowStore.getState().nodes).toHaveLength(1);
        expect(useFlowStore.getState().nodes[0]).toEqual(
            expect.objectContaining({ id: "n1" }),
        );
        expect(useFlowStore.getState().flowName).toBe("Test Flow"); // unchanged
    });

    it("does not update store when JSON fails schema validation", () => {
        const input = renderAndCapture();
        triggerRead(input, '{"name":"no nodes"}');
        expect(useFlowStore.getState().nodes).toEqual([]);
    });

    it("handles malformed JSON without throwing", () => {
        const input = renderAndCapture();
        expect(() => triggerRead(input, "not valid json {{{")).not.toThrow();
        expect(useFlowStore.getState().nodes).toEqual([]);
    });
});

describe("useFlowPersistence — getThumbnailFromNodes", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    type StoreNodes = ReturnType<typeof useFlowStore.getState>["nodes"];

    async function saveWithNodes(nodes: StoreNodes) {
        resetStore({ flowId: "flow-1", ownerId: OWNER_ID, nodes });
        const { result } = renderHook(() => useFlowPersistence());
        await act(async () => {
            await result.current.saveFlow();
        });
        return JSON.parse((fetch as Mock).mock.calls[0][1].body as string);
    }

    it("picks the most recently generated image node as thumbnail", async () => {
        const body = await saveWithNodes([
            {
                id: "n1",
                position: { x: 0, y: 0 },
                data: {
                    type: "image",
                    label: "Image",
                    images: ["https://old.jpg"],
                    generatedAt: 1000,
                },
            },
            {
                id: "n2",
                position: { x: 0, y: 0 },
                data: {
                    type: "image",
                    label: "Image",
                    images: ["https://new.jpg"],
                    generatedAt: 2000,
                },
            },
        ] as unknown as StoreNodes);
        expect(body.thumbnail).toBe("https://new.jpg");
    });

    it("uses upscale node output as thumbnail", async () => {
        const body = await saveWithNodes([
            {
                id: "n1",
                position: { x: 0, y: 0 },
                data: {
                    type: "upscale",
                    label: "Upscale",
                    image: "https://upscaled.jpg",
                    generatedAt: 1000,
                },
            },
        ] as unknown as StoreNodes);
        expect(body.thumbnail).toBe("https://upscaled.jpg");
    });

    it("uses resize node output as thumbnail", async () => {
        const body = await saveWithNodes([
            {
                id: "n1",
                position: { x: 0, y: 0 },
                data: {
                    type: "resize",
                    label: "Resize",
                    output: "https://resized.jpg",
                    generatedAt: 1000,
                },
            },
        ] as unknown as StoreNodes);
        expect(body.thumbnail).toBe("https://resized.jpg");
    });

    it("uses video node frame as thumbnail", async () => {
        const body = await saveWithNodes([
            {
                id: "n1",
                position: { x: 0, y: 0 },
                data: {
                    type: "video",
                    label: "Video",
                    images: ["https://frame.jpg"],
                    generatedAt: 1000,
                },
            },
        ] as unknown as StoreNodes);
        expect(body.thumbnail).toBe("https://frame.jpg");
    });

    it("omits thumbnail when no nodes have outputs", async () => {
        const body = await saveWithNodes([
            {
                id: "n1",
                position: { x: 0, y: 0 },
                data: { type: "llm", label: "LLM" },
            },
        ] as unknown as StoreNodes);
        expect(body.thumbnail).toBeUndefined();
    });
});
