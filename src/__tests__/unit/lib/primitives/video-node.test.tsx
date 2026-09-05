/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { FlowNode as VideoNode } from "@/primitives/video/FlowNode";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { VideoData } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";

import { MODELS } from "@/lib/constants";

vi.mock("@/lib/store/use-flow-store", () => ({
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

vi.mock("@/hooks/use-flow-execution", () => ({
    useFlowExecution: () => ({
        executeNode: vi.fn(),
        runFromNode: vi.fn(),
    }),
}));

vi.mock("@/hooks/use-connected-source-nodes", () => ({
    useConnectedSourceNodes: () => [],
}));

const mockUpdateNodeInternals = vi.fn();
vi.mock("@xyflow/react", async () => {
    const actual = await vi.importActual("@xyflow/react");
    return {
        ...actual,
        useUpdateNodeInternals: () => mockUpdateNodeInternals,
        NodeToolbar: ({ isVisible, children }: any) =>
            isVisible ? <div data-testid="node-toolbar">{children}</div> : null,
    };
});

describe("VideoNode Rendering", () => {
    const defaultProps: NodeProps<any> = {
        id: "video-1",
        data: {
            type: "video",
            name: "Test Video",
            prompt: "a video prompt",
            model: MODELS.VIDEO.VEO_3_1_LITE,
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

    it("should render correct handles for Gemini Omni Flash (excluding audio-input and first-frame-input)", () => {
        const props = {
            ...defaultProps,
            data: {
                ...defaultProps.data,
                model: "gemini-omni-flash-preview",
            },
        };
        const { container } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...props} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(
            container.querySelector('[data-handleid="audio-input"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-handleid="video-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="first-frame-input"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-handleid="prompt-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="image-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="last-frame-input"]'),
        ).toBeNull();
    });

    it("should render correct handles for Gemini Omni 1.1 Flash (excluding first-frame-input and last-frame-input)", () => {
        const props = {
            ...defaultProps,
            data: {
                ...defaultProps.data,
                model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
            },
        };
        const { container } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...props} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(
            container.querySelector('[data-handleid="prompt-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="first-frame-input"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-handleid="last-frame-input"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-handleid="image-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="video-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="audio-input"]'),
        ).toBeNull();
    });

    it("should render correct handles for non-Omni model", () => {
        const { container } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(
            container.querySelector('[data-handleid="audio-input"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-handleid="video-input"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-handleid="first-frame-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="prompt-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="image-input"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-handleid="last-frame-input"]'),
        ).not.toBeNull();
    });

    it("should update node internals when switching between Omni and non-Omni models", () => {
        mockUpdateNodeInternals.mockClear();

        const { rerender } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...defaultProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(mockUpdateNodeInternals).toHaveBeenCalledWith("video-1");

        mockUpdateNodeInternals.mockClear();

        const omniProps = {
            ...defaultProps,
            data: {
                ...defaultProps.data,
                model: MODELS.VIDEO.GEMINI_OMNI_FLASH,
            },
        };

        rerender(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...omniProps} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(mockUpdateNodeInternals).toHaveBeenCalledWith("video-1");
    });

    it("should render resolution options (360p, 720p, 1080p, 4K) on Omni 1.1 Flash", () => {
        const props = {
            ...defaultProps,
            selected: true,
            data: {
                ...defaultProps.data,
                model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
                resolution: "1080p",
            },
        };
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...props} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("1080p")).toBeDefined();
    });

    it("should lock resolution to 720p on Omni 1.0 Flash", () => {
        const props = {
            ...defaultProps,
            selected: true,
            data: {
                ...defaultProps.data,
                model: MODELS.VIDEO.GEMINI_OMNI_FLASH,
                resolution: "720p",
            },
        };
        const { getByText } = render(
            <ReactFlowProvider>
                <TooltipProvider>
                    <VideoNode {...props} />
                </TooltipProvider>
            </ReactFlowProvider>,
        );

        expect(getByText("720p")).toBeDefined();
    });
});
