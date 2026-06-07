/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { UpscaleNode } from "../components/nodes/upscale-node";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { UpscaleData } from "../lib/types";
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

describe("UpscaleNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "upscale-1",
        data: {
            type: "upscale",
            name: "Test Upscale",
            scale: 2,
            mode: "fast",
            image: "http://example.com/mock.jpg",
            upscaleFactor: "x2",
        } as unknown as UpscaleData,
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        type: "upscale",
        dragging: false,
    } as any;

    it("should render without crashing", () => {
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <UpscaleNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("Test Upscale")).toBeDefined();
    });
});
