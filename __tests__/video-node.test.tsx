/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { VideoNode } from "../components/video-node";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { VideoData } from "../lib/types";
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

describe("VideoNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "video-1",
        data: {
            type: "video",
            name: "Test Video",
            prompt: "a video prompt",
            model: "veo-2.0-high",
            motion: 5,
            images: [],
            aspectRatio: "16:9",
            duration: 6,
            generateAudio: false,
            resolution: "1080p",
        } as unknown as VideoData,
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        type: "video",
        dragging: false,
    } as any;

    it("should render without crashing", () => {
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("Test Video")).toBeDefined();
    });
});
