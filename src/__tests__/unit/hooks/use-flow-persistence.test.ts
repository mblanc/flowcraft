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
            await result.current.saveFlow();
        });

        expect(useFlowStore.getState().saveStatus).toBe("error");
    });

    it("sets saveStatus to 'error' when fetch throws a network error", async () => {
        (fetch as Mock).mockRejectedValue(new Error("Network failure"));

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
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

    it("allows save for templates regardless of ownership", async () => {
        resetStore({
            flowId: "flow-1",
            ownerId: "other-owner",
            isTemplate: true,
        });
        (fetch as Mock).mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFlowPersistence());

        await act(async () => {
            await result.current.saveFlow();
        });

        expect(fetch).toHaveBeenCalledOnce();
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
