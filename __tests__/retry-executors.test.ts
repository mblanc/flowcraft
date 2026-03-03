import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeImageNode, executeVideoNode } from "../lib/executors";
import { Node } from "@xyflow/react";
import { ImageData, VideoData } from "../lib/types";

describe("Executor Retry Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("executeImageNode should retry on 429 and eventually succeed", async () => {
        const mockNode = {
            id: "image-1",
            data: {
                type: "image",
                prompt: "a cat",
            } as ImageData,
        } as Node<ImageData>;

        const onNodeUpdate = vi.fn();
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => "Rate limit exceeded",
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ imageUrl: "http://success.com/image.png" }),
            });

        const result = await executeImageNode(
            mockNode,
            { prompt: "a cat" },
            {
                fetch: mockFetch as unknown as typeof fetch,
                onNodeUpdate,
            },
        );

        expect(result.images).toEqual(["http://success.com/image.png"]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(onNodeUpdate).toHaveBeenCalledWith("image-1", {
            error: expect.stringContaining("High traffic detected"),
        });
        expect(onNodeUpdate).toHaveBeenCalledWith("image-1", {
            error: undefined,
        });
    });

    it("executeVideoNode should retry on 429 and eventually succeed", async () => {
        const mockNode = {
            id: "video-1",
            data: {
                type: "video",
                prompt: "a jumping cat",
            } as VideoData,
        } as Node<VideoData>;

        const onNodeUpdate = vi.fn();
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => "Rate limit exceeded",
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ videoUrl: "gs://bucket/video.mp4" }),
            });

        const result = await executeVideoNode(
            mockNode,
            { prompt: "a jumping cat" },
            {
                fetch: mockFetch as unknown as typeof fetch,
                onNodeUpdate,
            },
        );

        expect(result.videoUrl).toBe("gs://bucket/video.mp4");
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(onNodeUpdate).toHaveBeenCalledWith("video-1", {
            error: expect.stringContaining("High traffic detected"),
        });
        expect(onNodeUpdate).toHaveBeenCalledWith("video-1", {
            error: undefined,
        });
    });

    it("executeVideoNode should fail after maximum retries", async () => {
        const mockNode = {
            id: "video-1",
            data: {
                type: "video",
                prompt: "a jumping cat",
            } as VideoData,
        } as Node<VideoData>;

        const onNodeUpdate = vi.fn();
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: async () => "Rate limit exceeded",
        });

        // withRetry uses exponential backoff. In tests we might want to mock timers
        // but for now let's just see if it fails as expected.
        // Note: Default maxRetries is 3 in withNodeRetry.

        await expect(
            executeVideoNode(
                mockNode,
                { prompt: "a jumping cat" },
                {
                    fetch: mockFetch as unknown as typeof fetch,
                    onNodeUpdate,
                },
            )
        ).rejects.toThrow(/High traffic detected/);

        expect(mockFetch).toHaveBeenCalledTimes(4); // initial + 3 retries
    }, 20000); // Increase timeout for backoff
});
