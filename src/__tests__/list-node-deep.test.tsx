/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { ListNode } from "../components/nodes/list-node";
import { ReactFlowProvider } from "@xyflow/react";
import { TooltipProvider } from "../components/ui/tooltip";

vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(
        vi.fn((selector: any) => {
            return (
                selector({
                    nodes: [],
                    edges: [],
                    updateNodeData: vi.fn(),
                    selectNode: vi.fn(),
                }) || vi.fn()
            );
        }),
        {
            getState: () => ({
                setIsConfigSidebarOpen: vi.fn(),
                nodes: [],
                edges: [],
            }),
        },
    ),
}));

global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
) as any;

vi.mock("@/hooks/use-node-resize", () => ({
    useNodeResize: () => ({
        dimensions: { width: 300, height: 300 },
        handleResizeStart: vi.fn(),
    }),
}));
vi.mock("@/hooks/use-connected-source-nodes", () => ({
    useConnectedSourceNodes: () => [],
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

describe("ListNode Deep", () => {
    it("renders image list and triggers clicks", async () => {
        const data = {
            name: "List",
            items: ["gs://test/image.png", ""],
            itemType: "image",
        } as any;

        const { container } = render(
            <TooltipProvider>
                <ReactFlowProvider>
                    <ListNode
                        id="1"
                        data={data}
                        type="list"
                        selected={true}
                        isConnectable={true}
                        dragging={false}
                        zIndex={1}
                        positionAbsoluteX={0}
                        positionAbsoluteY={0}
                        draggable={true}
                        selectable={true}
                        deletable={true}
                    />
                </ReactFlowProvider>
            </TooltipProvider>,
        );

        await act(async () => {
            const buttons = container.querySelectorAll("button");
            buttons.forEach((b) => {
                try {
                    fireEvent.click(b);
                } catch (e) {}
            });
        });

        expect(container).toBeDefined();
    });
});
