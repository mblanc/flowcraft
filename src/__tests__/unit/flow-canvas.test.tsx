/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { FlowCanvas } from "../components/flow/flow-canvas";
import { TooltipProvider } from "../components/ui/tooltip";

vi.mock("@xyflow/react/dist/style.css", () => ({}));

vi.mock("next-auth/react", () => ({
    useSession: vi.fn(() => ({ data: { user: { id: "user-1" } } })),
}));

vi.mock("next-themes", () => ({
    useTheme: vi.fn(() => ({ resolvedTheme: "dark" })),
}));

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: vi.fn((selector: any) =>
        selector({
            nodes: [],
            edges: [],
            onNodesChange: vi.fn(),
            onEdgesChange: vi.fn(),
            onConnect: vi.fn(),
            selectNode: vi.fn(),
            selectedNode: null,
            flowId: "flow-1",
            entityType: "workflow",
            addNodeWithType: vi.fn(),
            isRunning: false,
            ownerId: "user-1",
            sharedWith: [],
        }),
    ),
}));

vi.mock("../hooks/use-flow-execution", () => ({
    useFlowExecution: () => ({
        runFlow: vi.fn(),
        runSelectedNodes: vi.fn(),
    }),
}));

// Mock ResizeObserver for React Flow
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
) as any;

describe("FlowCanvas", () => {
    it("should render without crashing", () => {
        const { container } = render(
            <TooltipProvider>
                <FlowCanvas />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
        // Check for ReactFlow wrapper
        expect(container.querySelector(".react-flow")).toBeDefined();
    });
});
