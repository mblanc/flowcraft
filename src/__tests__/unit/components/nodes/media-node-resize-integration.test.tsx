// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FlowNode as ImageFlowNode } from "@/primitives/image/FlowNode";
import { FlowNode as VideoFlowNode } from "@/primitives/video/FlowNode";
import { CanvasNode as ImageCanvasNode } from "@/primitives/image/CanvasNode";
import { CanvasNode as VideoCanvasNode } from "@/primitives/video/CanvasNode";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { MODELS } from "@/lib/constants";
import type { ImageData } from "@/lib/types";
import type { CanvasImageData, CanvasVideoData } from "@/lib/canvas/types";

vi.mock("next/image", () => ({
    default: ({
        fill: _fill,
        unoptimized: _unoptimized,
        ...props
    }: Record<string, any>) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={props.alt || ""} {...props} />
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

vi.mock("@/hooks/use-signed-url", () => ({
    useSignedUrl: (url?: string) => ({
        displayUrl: url,
        signedUrl: url,
        loading: false,
    }),
    useSignedUrls: () => ({}),
}));

vi.mock("@/hooks/use-regenerate-node", () => ({
    useRegenerateNode: () => ({
        regenerate: vi.fn(),
    }),
}));

vi.mock("@/components/nodes/mention-editor", () => ({
    MentionEditor: () => <div data-testid="mention-editor" />,
}));

vi.mock("@/components/nodes/media-viewer", () => ({
    MediaViewer: () => null,
}));

vi.mock("@/components/canvas/canvas-node-context-menu", () => ({
    CanvasNodeContextMenu: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));

describe("Media Node Resize Integration (Flow & Canvas)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("resizes Flow ImageNode smoothly without jumping back to 300px on mid-drag image load or leaving negative space on shrink", () => {
        useFlowStore.getState().setNodes([
            {
                id: "img-1",
                type: "image",
                position: { x: 0, y: 0 },
                data: {
                    name: "Hero Image",
                    type: "image",
                    prompt: "A landscape",
                    aspectRatio: "16:9",
                    imageSize: "1K",
                    model: MODELS.IMAGE.GEMINI_NANO_BANANA_2_1,
                    groundingGoogleSearch: false,
                    groundingImageSearch: false,
                    images: ["https://storage.googleapis.com/bucket/hero.png"],
                    executing: false,
                },
            } as any,
        ]);

        function FlowImageTestHarness() {
            const node = useFlowStore((s) =>
                s.nodes.find((n) => n.id === "img-1"),
            )!;
            return (
                <ReactFlowProvider>
                    <TooltipProvider>
                        <ImageFlowNode
                            {...({
                                id: node.id,
                                data: node.data as any,
                                selected: true,
                                type: "image",
                                zIndex: 1,
                                isConnectable: true,
                                positionAbsoluteX: 0,
                                positionAbsoluteY: 0,
                                dragging: false,
                            } as any)}
                        />
                    </TooltipProvider>
                </ReactFlowProvider>
            );
        }

        const { getByAltText, getByTestId, container } = render(
            <FlowImageTestHarness />,
        );
        const nodeWrapper = container.firstElementChild as HTMLElement;
        const img = getByAltText("Hero Image") as HTMLImageElement;

        // 1. Simulate natural 16:9 image load (1920x1080)
        Object.defineProperty(img, "naturalWidth", {
            value: 1920,
            configurable: true,
        });
        Object.defineProperty(img, "naturalHeight", {
            value: 1080,
            configurable: true,
        });
        fireEvent.load(img);

        expect(nodeWrapper.style.width).toBe("300px");
        expect(nodeWrapper.style.height).toBe("169px");

        // 2. Start dragging the resize handle across the old 320px/640px Retina threshold
        const handle = getByTestId("node-resize-handle");
        fireEvent.mouseDown(handle, { clientX: 300, clientY: 169 });

        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 360, clientY: 210 }),
            );
        });

        expect(nodeWrapper.style.width).toBe("360px");
        expect(nodeWrapper.style.height).toBe("203px");

        //Even if the browser fires a spurious load event mid-drag, dimensions must NOT jump back to 300px
        fireEvent.load(img);
        expect(nodeWrapper.style.width).toBe("360px");
        expect(nodeWrapper.style.height).toBe("203px");

        // 3. Resize all the way down past minimum bounds and verify zero vertical negative space
        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 50, clientY: 20 }),
            );
            document.dispatchEvent(new MouseEvent("mouseup"));
        });

        const finalWidth = parseInt(nodeWrapper.style.width, 10);
        const finalHeight = parseInt(nodeWrapper.style.height, 10);
        expect(finalWidth).toBe(150);
        expect(finalHeight).toBe(Math.round(150 / (16 / 9))); // 84px, NOT 200px!

        const updatedNode = useFlowStore
            .getState()
            .nodes.find((n) => n.id === "img-1")!;
        const updatedImageData = updatedNode.data as ImageData;
        expect(updatedImageData.width).toBe(150);
        expect(updatedImageData.height).toBe(84);
    });

    it("resizes Flow VideoNode down without leaving vertical negative space", () => {
        useFlowStore.getState().setNodes([
            {
                id: "vid-1",
                type: "video",
                position: { x: 0, y: 0 },
                data: {
                    name: "Scene Video",
                    type: "video",
                    prompt: "A scene",
                    images: [],
                    aspectRatio: "16:9",
                    duration: 4,
                    resolution: "720p",
                    generateAudio: true,
                    model: MODELS.VIDEO.VEO_3_1_FAST,
                    videoUrl: "https://storage.googleapis.com/bucket/scene.mp4",
                    videoUrls: [
                        "https://storage.googleapis.com/bucket/scene.mp4",
                    ],
                    executing: false,
                },
            } as any,
        ]);

        function FlowVideoTestHarness() {
            const node = useFlowStore((s) =>
                s.nodes.find((n) => n.id === "vid-1"),
            )!;
            return (
                <ReactFlowProvider>
                    <TooltipProvider>
                        <VideoFlowNode
                            {...({
                                id: node.id,
                                data: node.data as any,
                                selected: true,
                                type: "video",
                                zIndex: 1,
                                isConnectable: true,
                                positionAbsoluteX: 0,
                                positionAbsoluteY: 0,
                                dragging: false,
                            } as any)}
                        />
                    </TooltipProvider>
                </ReactFlowProvider>
            );
        }

        const { container, getByTestId } = render(<FlowVideoTestHarness />);
        const nodeWrapper = container.firstElementChild as HTMLElement;
        const video = container.querySelector("video") as HTMLVideoElement;

        Object.defineProperty(video, "videoWidth", {
            value: 1920,
            configurable: true,
        });
        Object.defineProperty(video, "videoHeight", {
            value: 1080,
            configurable: true,
        });
        fireEvent.loadedMetadata(video);

        expect(nodeWrapper.style.width).toBe("320px");
        expect(nodeWrapper.style.height).toBe("180px");

        // Shrink down below 320px width
        const handle = getByTestId("node-resize-handle");
        fireEvent.mouseDown(handle, { clientX: 320, clientY: 180 });

        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 180, clientY: 100 }),
            );
            document.dispatchEvent(new MouseEvent("mouseup"));
        });

        const finalWidth = parseInt(nodeWrapper.style.width, 10);
        const finalHeight = parseInt(nodeWrapper.style.height, 10);
        // 320 - 140 = 180px width -> 101px height (exact 16:9, NOT clamped at 180px height!)
        expect(finalWidth).toBe(180);
        expect(finalHeight).toBe(Math.round(180 / (16 / 9)));
    });

    it("keeps Canvas ImageNode and VideoNode data.width/height and node.width/height in sync and preserves aspect ratio on resize", () => {
        useCanvasStore.setState({
            nodes: [
                {
                    id: "c-img-1",
                    type: "canvas-image",
                    position: { x: 0, y: 0 },
                    width: 300,
                    height: 300,
                    data: {
                        label: "Canvas Image 1",
                        status: "ready",
                        sourceUrl:
                            "https://storage.googleapis.com/bucket/c-img.png",
                        width: 300,
                        height: 300,
                    },
                } as any,
                {
                    id: "c-vid-1",
                    type: "canvas-video",
                    position: { x: 400, y: 0 },
                    width: 360,
                    height: 280,
                    data: {
                        label: "Canvas Video 1",
                        status: "ready",
                        sourceUrl:
                            "https://storage.googleapis.com/bucket/c-vid.mp4",
                        width: 360,
                        height: 280,
                    },
                } as any,
            ],
        });

        function CanvasNodesHarness() {
            const imgNode = useCanvasStore((s) =>
                s.nodes.find((n) => n.id === "c-img-1"),
            )!;
            const vidNode = useCanvasStore((s) =>
                s.nodes.find((n) => n.id === "c-vid-1"),
            )!;
            return (
                <ReactFlowProvider>
                    <div>
                        <ImageCanvasNode
                            {...({
                                id: imgNode.id,
                                data: imgNode.data as any,
                                selected: true,
                            } as any)}
                        />
                        <VideoCanvasNode
                            {...({
                                id: vidNode.id,
                                data: vidNode.data as any,
                                selected: true,
                            } as any)}
                        />
                    </div>
                </ReactFlowProvider>
            );
        }

        const { getByAltText, getAllByTestId, container } = render(
            <CanvasNodesHarness />,
        );
        const img = getByAltText("Canvas Image 1") as HTMLImageElement;
        const video = container.querySelector("video") as HTMLVideoElement;

        // Load 16:9 media into both Canvas nodes
        Object.defineProperty(img, "naturalWidth", {
            value: 1600,
            configurable: true,
        });
        Object.defineProperty(img, "naturalHeight", {
            value: 900,
            configurable: true,
        });
        fireEvent.load(img);

        Object.defineProperty(video, "videoWidth", {
            value: 1920,
            configurable: true,
        });
        Object.defineProperty(video, "videoHeight", {
            value: 1080,
            configurable: true,
        });
        fireEvent.loadedMetadata(video);

        const [imgHandle, vidHandle] = getAllByTestId("node-resize-handle");

        // Resize Canvas Image down to minimum width (150px) and then back up to 400px
        fireEvent.mouseDown(imgHandle, { clientX: 300, clientY: 169 });
        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 100, clientY: 50 }),
            );
            document.dispatchEvent(new MouseEvent("mouseup"));
        });

        const imgStoreNode = useCanvasStore
            .getState()
            .nodes.find((n) => n.id === "c-img-1")!;
        const imgStoreData = imgStoreNode.data as CanvasImageData;
        expect(imgStoreData.width).toBe(150);
        expect(imgStoreData.height).toBe(84);
        expect(imgStoreNode.width).toBe(150);
        expect(imgStoreNode.height).toBe(84);

        // Resize Canvas Video down to 180px width
        fireEvent.mouseDown(vidHandle, { clientX: 360, clientY: 203 });
        act(() => {
            document.dispatchEvent(
                new MouseEvent("mousemove", { clientX: 180, clientY: 100 }),
            );
            document.dispatchEvent(new MouseEvent("mouseup"));
        });

        const vidStoreNode = useCanvasStore
            .getState()
            .nodes.find((n) => n.id === "c-vid-1")!;
        const vidStoreData = vidStoreNode.data as CanvasVideoData;
        expect(vidStoreData.width).toBe(180);
        expect(vidStoreData.height).toBe(101);
        expect(vidStoreNode.width).toBe(180);
        expect(vidStoreNode.height).toBe(101);
    });
});
