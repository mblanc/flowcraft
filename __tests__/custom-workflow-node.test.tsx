/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CustomWorkflowNode } from "../components/nodes/custom-workflow-node";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { CustomWorkflowData } from "../lib/types";
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

vi.mock("../hooks/use-flow-execution", () => ({
    useFlowExecution: () => ({
        executeNode: vi.fn(),
        runFromNode: vi.fn(),
    }),
}));

describe("CustomWorkflowNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "custom-1",
        data: {
            type: "custom-workflow",
            name: "Test Custom Flow",
            subWorkflowId: "sub-1",
            inputs: {},
            outputs: {},
        } as unknown as CustomWorkflowData,
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        type: "custom-workflow",
        dragging: false,
    } as any;

    it("should render without crashing", () => {
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <CustomWorkflowNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("Test Custom Flow")).toBeDefined();
    });
});
