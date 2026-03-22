/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ImageNode } from "../components/image-node";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { ImageData } from "../lib/types";
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

vi.mock("../hooks/use-connected-source-nodes", () => ({
    useConnectedSourceNodes: () => [],
}));

describe("ImageNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "image-1",
        data: {
            type: "image",
            name: "Test Image Node",
            model: "gemini-3.1-flash-image-preview",
            prompt: "a landscape",
            images: [],
            aspectRatio: "1:1",
            resolution: "1K",
            groundingGoogleSearch: false,
            groundingImageSearch: false,
        } as ImageData,
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        type: "image",
        dragging: false,
    } as any;

    it("should render without crashing", () => {
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <ImageNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("Test Image Node")).toBeDefined();
    });

    it("should render images if available", () => {
        const propsWithImage = {
            ...defaultProps,
            data: {
                ...defaultProps.data,
                images: ["https://example.com/test.png"],
            },
        };

        const { container } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <ImageNode {...propsWithImage} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        const img = container.querySelector("img");
        expect(img).toBeDefined();
        expect(img?.src).toContain("test.png");
    });
});
