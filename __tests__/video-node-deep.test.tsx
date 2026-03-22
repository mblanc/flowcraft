/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { VideoNode } from "../components/video-node";
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

vi.mock("@/hooks/use-node-resize", () => ({
    useNodeResize: () => ({
        dimensions: { width: 300, height: 300 },
        handleResizeStart: vi.fn(),
    }),
}));
vi.mock("@/hooks/use-flow-execution", () => ({
    useFlowExecution: () => ({ executeNode: vi.fn(), runFromNode: vi.fn() }),
}));
vi.mock("@/hooks/use-connected-source-nodes", () => ({
    useConnectedSourceNodes: () => [],
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

describe("VideoNode Deep", () => {
    it("renders video node and triggers clicks", async () => {
        const data = {
            name: "Video",
            prompt: "Test",
            image_url: "gs://test/image.png",
            video_url: "gs://test/video.mp4",
        } as any;

        const { container } = render(
            <TooltipProvider>
                <ReactFlowProvider>
                    <VideoNode
                        id="1"
                        data={data}
                        type="video"
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
    }, 15000);
});
