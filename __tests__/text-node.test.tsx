/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { TextNode } from "../components/nodes/text-node";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { TextData } from "../lib/types";
import { TooltipProvider } from "../components/ui/tooltip";

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: Object.assign(
        (selector: any) =>
            selector({
                updateNodeData: vi.fn(),
                selectNode: vi.fn(),
            }),
        {
            getState: () => ({
                updateNodeData: vi.fn(),
            }),
        },
    ),
}));

describe("TextNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "text-1",
        data: {
            type: "text",
            name: "Test Text Node",
            text: "Hello World",
        } as TextData,
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        type: "text",
        dragging: false,
    } as any;

    it("should render without crashing and display text", () => {
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <TextNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("Test Text Node")).toBeDefined();
        // Check for textarea value
        const textarea = document.querySelector("textarea");
        expect(textarea).toBeDefined();
        expect(textarea?.value).toBe("Hello World");
    });
});
