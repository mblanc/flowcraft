/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { TooltipProvider } from "../components/ui/tooltip";

import { LLMConfig } from "../components/panels/llm-config";
import { ImageConfig } from "../components/panels/image-config";
import { VideoConfig } from "../components/panels/video-config";
import { TextConfig } from "../components/panels/text-config";
import { FileConfig } from "../components/panels/file-config";

import type {
    LLMData,
    ImageData,
    VideoData,
    TextData,
    FileData,
} from "../lib/types";

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: vi.fn((selector: any) =>
        selector({
            updateNodeData: vi.fn(),
        }),
    ),
}));

vi.mock("../hooks/use-connected-source-nodes", () => ({
    useConnectedSourceNodes: () => [],
}));

describe("Inner Config Panels Rendering", () => {
    it("renders LLMConfig without crashing", () => {
        const dummyData = {
            name: "test",
            model: "gemini-3-flash-preview",
            instructions: "test",
        } as LLMData;
        const { container } = render(
            <TooltipProvider>
                <LLMConfig data={dummyData} nodeId="1" />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
    });

    it("renders ImageConfig without crashing", () => {
        const dummyData = {
            name: "test",
            model: "imagen-3",
            prompt: "test",
            aspectRatio: "1:1",
            resolution: "1080p",
            images: [],
        } as unknown as ImageData;
        const { container } = render(
            <TooltipProvider>
                <ImageConfig data={dummyData} nodeId="1" />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
    });

    it("renders VideoConfig without crashing", () => {
        const dummyData = {
            name: "test",
            model: "veo-2.0-high",
            prompt: "test",
            motion: 5,
            images: [],
        } as unknown as VideoData;
        const { container } = render(
            <TooltipProvider>
                <VideoConfig data={dummyData} nodeId="1" />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
    });

    it("renders TextConfig without crashing", () => {
        const dummyData = {
            name: "test",
            text: "test text",
        } as TextData;
        const { container } = render(
            <TooltipProvider>
                <TextConfig data={dummyData} nodeId="1" />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
    });

    it("renders FileConfig without crashing", () => {
        const dummyData = {
            name: "test",
            files: [],
        } as unknown as FileData;
        const { container } = render(
            <TooltipProvider>
                <FileConfig data={dummyData} nodeId="1" />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
    });
});
