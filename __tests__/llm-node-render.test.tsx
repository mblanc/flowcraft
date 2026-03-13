/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { LLMNode } from "../components/llm-node";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { LLMData } from "../lib/types";
import { TooltipProvider } from "../components/ui/tooltip";

// Mock the flow store
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

// Mock useFlowExecution
vi.mock("../hooks/use-flow-execution", () => ({
    useFlowExecution: () => ({
        executeNode: vi.fn(),
        runFromNode: vi.fn(),
    }),
}));

// Mock useConnectedSourceNodes
vi.mock("../hooks/use-connected-source-nodes", () => ({
    useConnectedSourceNodes: () => [],
}));

describe("LLMNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "test-node",
        data: {
            type: "llm",
            name: "Test LLM",
            model: "gemini-pro",
            instructions: "test instructions",
            // output is deliberately undefined to test the fix
            outputType: "text",
        } as LLMData,
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragHandle: ".drag-handle",
        type: "llm",
        dragging: false,
        measured: { width: 300, height: 400 },
    } as any;

    it("should render without crashing even if output is undefined", () => {
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <LLMNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("Test LLM")).toBeDefined();
    });

    it("should handle transition from undefined output to empty string without looping", () => {
        // This test passing means it didn't throw "Too many re-renders"
        const { rerender } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <LLMNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        const updatedProps = {
            ...defaultProps,
            data: {
                ...defaultProps.data,
                output: "",
            },
        };

        rerender(
            <ReactFlowProvider>
                <TooltipProvider>
                    <LLMNode {...updatedProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );
    });
});
