/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ListNode } from "../components/list-node";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { ListData } from "../lib/types";
import { TooltipProvider } from "../components/ui/tooltip";

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(
        (selector: any) =>
            selector({
                updateNodeData: vi.fn(),
                selectNode: vi.fn(),
                setIsConfigSidebarOpen: vi.fn(),
            }),
        {
            getState: () => ({
                setIsConfigSidebarOpen: vi.fn(),
            }),
        },
    ),
}));

describe("ListNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "list-1",
        data: {
            type: "list",
            name: "Test List",
            items: ["item 1", "item 2"],
        } as ListData,
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        type: "list",
        dragging: false,
    } as any;

    it("should render without crashing", () => {
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <ListNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("Test List")).toBeDefined();
    });
});
