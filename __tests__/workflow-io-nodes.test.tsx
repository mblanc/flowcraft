/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { WorkflowInputNode } from "../components/workflow-input-node";
import { WorkflowOutputNode } from "../components/workflow-output-node";
import { describe, it, expect, vi } from "vitest";
import { WorkflowInputData, WorkflowOutputData } from "../lib/types";

// Mock @xyflow/react components to avoid issues with context
vi.mock("@xyflow/react", () => ({
    Handle: ({ type, position }: any) => (
        <div data-testid={`handle-${type}-${position}`} />
    ),
    Position: {
        Left: "left",
        Right: "right",
        Top: "top",
        Bottom: "bottom",
    },
}));

// Mock the store
vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: (selector: any) =>
        selector({
            selectedNode: null,
            updateNodeData: vi.fn(),
        }),
}));

describe("Workflow IO Nodes", () => {
    describe("WorkflowInputNode", () => {
        const mockData: WorkflowInputData = {
            type: "workflow-input",
            name: "Input Node",
            portName: "prompt",
            portType: "string",
            portRequired: true,
            portDefaultValue: "Hello",
        };

        it("should render correctly", () => {
            render(
                <WorkflowInputNode
                    id="1"
                    data={mockData}
                    selected={false}
                    type="workflow-input"
                    zIndex={0}
                    isConnectable={true}
                    deletable={true}
                    selectable={true}
                    dragging={false}
                    draggable={true}
                    positionAbsoluteX={0}
                    positionAbsoluteY={0}
                />,
            );
            expect(screen.getByText("Workflow Input")).toBeInTheDocument();
            expect(screen.getByDisplayValue("prompt")).toBeInTheDocument();
            expect(screen.getByText("String")).toBeInTheDocument();
        });
    });

    describe("WorkflowOutputNode", () => {
        const mockData: WorkflowOutputData = {
            type: "workflow-output",
            name: "Output Node",
            portName: "result",
            portType: "image",
        };

        it("should render correctly", () => {
            render(
                <WorkflowOutputNode
                    id="2"
                    data={mockData}
                    selected={false}
                    type="workflow-output"
                    zIndex={0}
                    isConnectable={true}
                    deletable={true}
                    selectable={true}
                    dragging={false}
                    draggable={true}
                    positionAbsoluteX={0}
                    positionAbsoluteY={0}
                />,
            );
            expect(screen.getByText("Workflow Output")).toBeInTheDocument();
            expect(screen.getByDisplayValue("result")).toBeInTheDocument();
            expect(screen.getByText("Image")).toBeInTheDocument();
        });
    });
});
