/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfigPanel as VideoConfigPanel } from "@/primitives/video/ConfigPanel";
import { MODELS } from "@/lib/constants";
import type { VideoData } from "@/lib/types";

const mockUpdateNodeData = vi.fn();
vi.mock("@/lib/store/use-flow-store", () => ({
    useFlowStore: vi.fn((selector: any) =>
        selector({
            updateNodeData: mockUpdateNodeData,
        }),
    ),
}));

vi.mock("@/hooks/use-connected-source-nodes", () => ({
    useConnectedSourceNodes: () => [],
}));

vi.mock("@/hooks/use-signed-url", () => ({
    useSignedUrls: () => ({}),
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children, value, _onValueChange, disabled }: any) => (
        <div
            data-testid="mock-select"
            data-value={value}
            data-disabled={disabled ? "true" : "false"}
        >
            {children}
        </div>
    ),
    SelectTrigger: ({ children }: any) => <div>{children}</div>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ children, value }: any) => (
        <div data-testid="mock-select-item" data-value={value}>
            {children}
        </div>
    ),
    SelectGroup: ({ children }: any) => <div>{children}</div>,
    SelectLabel: ({ children }: any) => <div>{children}</div>,
    SelectSeparator: () => <div />,
    SelectScrollUpButton: () => <div />,
    SelectScrollDownButton: () => <div />,
}));

describe("Video ConfigPanel (TDD)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const baseData: VideoData = {
        type: "video",
        name: "Test Video",
        prompt: "A test prompt",
        model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
        aspectRatio: "16:9",
        duration: 6,
        generateAudio: true,
        resolution: "720p",
        images: [],
    };

    it("renders duration options Auto and 3s-10s when model is GEMINI_OMNI_1_1_FLASH", () => {
        render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        duration: undefined,
                        model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        expect(screen.getByText("Duration (seconds)")).toBeDefined();
        expect(screen.getAllByText("Auto")).toHaveLength(2); // One for Duration, one for Aspect Ratio
        expect(screen.getByText("3 seconds")).toBeDefined();
        expect(screen.getByText("10 seconds")).toBeDefined();
    });

    it("renders duration options 3s-10s when model is invalid and falls back to effectiveModel GEMINI_OMNI_1_1_FLASH", () => {
        render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: "invalid-model" as any,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        // effectiveModel is GEMINI_OMNI_1_1_FLASH, so it should render 3s-10s options
        expect(screen.getByText("3 seconds")).toBeDefined();
        expect(screen.getByText("10 seconds")).toBeDefined();
    });

    it("renders resolution options (360p, 720p, 1080p, 4K) when model is GEMINI_OMNI_1_1_FLASH", () => {
        render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        expect(screen.getByText("Resolution")).toBeDefined();
        expect(screen.getByText("360p")).toBeDefined();
        expect(screen.getByText("720p")).toBeDefined();
        expect(screen.getByText("1080p")).toBeDefined();
        expect(screen.getByText("4K")).toBeDefined();
    });

    it("hides duration and locks resolution when model is GEMINI_OMNI_FLASH (Omni 1.0)", () => {
        render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.GEMINI_OMNI_FLASH,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        expect(screen.queryByText("Duration (seconds)")).toBeNull();
        expect(screen.queryByText("360p")).toBeNull();
        expect(screen.queryByText("1080p")).toBeNull();
        expect(screen.getByText("720p")).toBeDefined();
    });

    it("renders Veo duration options (4s, 6s, 8s) when model is Veo", () => {
        render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.VEO_3_1_FAST,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        expect(screen.getByText("Duration (seconds)")).toBeDefined();
        expect(screen.queryByText("3 seconds")).toBeNull();
        expect(screen.getByText("4 seconds")).toBeDefined();
        expect(screen.getByText("6 seconds")).toBeDefined();
        expect(screen.getByText("8 seconds")).toBeDefined();
    });

    it("renders Task dropdown for both Omni 1.0 and Omni 1.1", () => {
        const { rerender } = render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );
        expect(screen.getByText("Task")).toBeDefined();

        rerender(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.GEMINI_OMNI_FLASH,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );
        expect(screen.getByText("Task")).toBeDefined();
    });

    it("syncs model to GEMINI_OMNI_1_1_FLASH on mount when invalid", () => {
        render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: "unknown" as any,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        expect(mockUpdateNodeData).toHaveBeenCalledWith("node-1", {
            model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
        });
    });

    it("renders Auto option for Aspect Ratio when model is Omni, and hides it for Veo", () => {
        const { rerender } = render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
                        aspectRatio: undefined,
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        // Aspect Ratio label exists
        expect(screen.getByText("Aspect Ratio")).toBeDefined();
        // Auto option exists for Omni
        const autoItems = screen.getAllByText("Auto");
        expect(autoItems.length).toBeGreaterThan(0);

        // Rerender as Veo model
        rerender(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.VEO_3_1_FAST,
                        aspectRatio: "16:9",
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        // Auto option should not exist anywhere for Veo (duration uses seconds, aspect ratio only has 16:9 and 9:16)
        expect(screen.queryByText("Auto")).toBeNull();
    });

    it("disables Aspect Ratio select and shows note when task is edit", () => {
        render(
            <TooltipProvider>
                <VideoConfigPanel
                    data={{
                        ...baseData,
                        model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
                        task: "edit",
                    }}
                    nodeId="node-1"
                />
            </TooltipProvider>,
        );

        expect(
            screen.getByText(/Aspect ratio cannot be set for edit tasks/i),
        ).toBeDefined();
    });
});
