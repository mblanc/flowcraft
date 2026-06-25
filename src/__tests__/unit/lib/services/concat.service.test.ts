import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@mediabunny/server", () => ({
    registerMediabunnyServer: vi.fn(),
}));

vi.mock("@/lib/services/storage.service", () => ({
    storageService: {
        getSignedUrl: vi
            .fn()
            .mockImplementation((uri: string) =>
                Promise.resolve(`https://signed.example.com/${uri}`),
            ),
        uploadFile: vi.fn().mockResolvedValue("gs://bucket/concat-out.mp4"),
    },
}));

vi.mock("@/app/logger", () => ({
    default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ── mediabunny mock ───────────────────────────────────────────────────────────
// Control what packets the sink yields per test via this shared array.
const mockVideoPackets: Array<{
    data: Uint8Array;
    type: "key" | "delta";
    timestamp: number;
    duration: number;
}> = [];

// Mutable config so individual tests can change audio/video track availability.
const mockInputConfig = {
    hasVideoTrack: true,
    hasAudioTrack: true,
    clipDuration: 4,
};

// Shared mock instances — rebuilt in beforeEach via mock constructors
let mockVideoSource: {
    add: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
};
let mockAudioSource: {
    add: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
};
let mockOutput: {
    addVideoTrack: ReturnType<typeof vi.fn>;
    addAudioTrack: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
};

vi.mock("mediabunny", () => {
    const EncodedPacket = vi.fn(function (
        data: Uint8Array,
        type: "key" | "delta",
        timestamp: number,
        duration: number,
    ) {
        return { data, type, timestamp, duration };
    });

    const EncodedPacketSink = vi.fn(function () {
        return {
            packets: async function* () {
                for (const p of mockVideoPackets) {
                    yield p;
                }
            },
        };
    });

    const EncodedVideoPacketSource = vi.fn(function () {
        mockVideoSource = {
            add: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
        };
        return mockVideoSource;
    });

    const EncodedAudioPacketSource = vi.fn(function () {
        mockAudioSource = {
            add: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
        };
        return mockAudioSource;
    });

    const Output = vi.fn(function () {
        mockOutput = {
            addVideoTrack: vi.fn(),
            addAudioTrack: vi.fn(),
            start: vi.fn().mockResolvedValue(undefined),
            finalize: vi.fn().mockResolvedValue(undefined),
            cancel: vi.fn().mockResolvedValue(undefined),
        };
        return mockOutput;
    });

    const Mp4OutputFormat = vi.fn(function () {
        return {};
    });

    const BufferTarget = vi.fn(function () {
        return { buffer: new ArrayBuffer(0) };
    });

    const Input = vi.fn(function () {
        const videoTrack = mockInputConfig.hasVideoTrack
            ? {
                  getDecoderConfig: vi.fn().mockResolvedValue({
                      codec: "avc1.42001f",
                      codedWidth: 1280,
                      codedHeight: 720,
                  }),
              }
            : null;

        const audioTrack = mockInputConfig.hasAudioTrack
            ? {
                  getDecoderConfig: vi.fn().mockResolvedValue({
                      codec: "mp4a.40.2",
                      numberOfChannels: 2,
                      sampleRate: 48000,
                  }),
              }
            : null;

        return {
            getPrimaryVideoTrack: vi.fn().mockResolvedValue(videoTrack),
            getPrimaryAudioTrack: vi.fn().mockResolvedValue(audioTrack),
            computeDuration: vi
                .fn()
                .mockResolvedValue(mockInputConfig.clipDuration),
            getDurationFromMetadata: vi
                .fn()
                .mockResolvedValue(mockInputConfig.clipDuration),
        };
    });

    const UrlSource = vi.fn(function () {
        return {};
    });
    const ALL_FORMATS: never[] = [];

    return {
        EncodedPacket,
        EncodedPacketSink,
        EncodedVideoPacketSource,
        EncodedAudioPacketSource,
        Output,
        Mp4OutputFormat,
        BufferTarget,
        Input,
        UrlSource,
        ALL_FORMATS,
    };
});

import { storageService } from "@/lib/services/storage.service";
import { EncodedAudioPacketSource } from "mediabunny";
import { ConcatService } from "@/lib/services/concat.service";

const mockGetSignedUrl = vi.mocked(storageService.getSignedUrl);
const mockUploadFile = vi.mocked(storageService.uploadFile);

let service: ConcatService;

beforeEach(() => {
    vi.clearAllMocks();
    mockVideoPackets.length = 0;
    mockInputConfig.hasVideoTrack = true;
    mockInputConfig.hasAudioTrack = true;
    mockInputConfig.clipDuration = 4;
    service = new ConcatService();
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("ConcatService — edge cases", () => {
    it("throws when given zero URIs", async () => {
        await expect(service.concatVideos([])).rejects.toThrow(
            "At least one input URI required",
        );
    });

    it("returns the single URI unchanged when given exactly one URI", async () => {
        const result = await service.concatVideos(["gs://bucket/clip1.mp4"]);
        expect(result).toBe("gs://bucket/clip1.mp4");
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
        expect(mockUploadFile).not.toHaveBeenCalled();
    });
});

// ─── Signed URL resolution ────────────────────────────────────────────────────

describe("ConcatService — signed URL resolution", () => {
    it("resolves a signed URL for each input GCS URI", async () => {
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        expect(mockGetSignedUrl).toHaveBeenCalledWith("gs://bucket/a.mp4");
        expect(mockGetSignedUrl).toHaveBeenCalledWith("gs://bucket/b.mp4");
        expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
    });
});

// ─── Output lifecycle ────────────────────────────────────────────────────────

describe("ConcatService — output lifecycle", () => {
    it("calls start() before finalize()", async () => {
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        const startOrder = mockOutput.start.mock.invocationCallOrder[0];
        const finalizeOrder = mockOutput.finalize.mock.invocationCallOrder[0];
        expect(startOrder).toBeLessThan(finalizeOrder);
    });

    it("adds a video track to the output", async () => {
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        expect(mockOutput.addVideoTrack).toHaveBeenCalledTimes(1);
    });

    it("adds an audio track when the first clip has audio", async () => {
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        expect(mockOutput.addAudioTrack).toHaveBeenCalledTimes(1);
    });

    it("does not add an audio track when the first clip has no audio", async () => {
        mockInputConfig.hasAudioTrack = false;
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        expect(mockOutput.addAudioTrack).not.toHaveBeenCalled();
        expect(EncodedAudioPacketSource).not.toHaveBeenCalled();
    });
});

// ─── Upload lifecycle ─────────────────────────────────────────────────────────

describe("ConcatService — upload lifecycle", () => {
    it("uploads the buffer to GCS with video/mp4 content type", async () => {
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        expect(mockUploadFile).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.stringContaining("concat-"),
            "video/mp4",
        );
    });

    it("returns the GCS URI produced by uploadFile", async () => {
        mockUploadFile.mockResolvedValueOnce("gs://bucket/result.mp4");
        const result = await service.concatVideos([
            "gs://bucket/a.mp4",
            "gs://bucket/b.mp4",
        ]);
        expect(result).toBe("gs://bucket/result.mp4");
    });

    it("propagates upload errors to the caller", async () => {
        mockUploadFile.mockRejectedValueOnce(new Error("upload failed"));
        await expect(
            service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]),
        ).rejects.toThrow("upload failed");
    });
});

// ─── Packet timestamp offsetting ─────────────────────────────────────────────

describe("ConcatService — packet timestamp offsetting", () => {
    it("writes clip 1 packets at their original timestamps", async () => {
        mockVideoPackets.push({
            data: new Uint8Array([1]),
            type: "key",
            timestamp: 0,
            duration: 0.04,
        });

        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);

        expect(mockVideoSource.add.mock.calls[0][0].timestamp).toBeCloseTo(0);
    });

    it("offsets clip 2 packet timestamps by the duration of clip 1", async () => {
        mockVideoPackets.push({
            data: new Uint8Array([1]),
            type: "key",
            timestamp: 0,
            duration: 0.04,
        });

        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);

        const clip2Call = mockVideoSource.add.mock.calls[1];
        expect(clip2Call[0].timestamp).toBeCloseTo(4);
    });

    it("offsets clip 2 packet timestamps by the actual packet end time of clip 1 when it exceeds nominal duration", async () => {
        mockInputConfig.clipDuration = 4;
        mockVideoPackets.push(
            {
                data: new Uint8Array([1]),
                type: "key",
                timestamp: 0,
                duration: 4.032,
            },
            {
                data: new Uint8Array([2]),
                type: "delta",
                timestamp: 4.032,
                duration: 0.033,
            },
        );

        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);

        const clip2Call = mockVideoSource.add.mock.calls[2];
        expect(clip2Call[0].timestamp).toBeCloseTo(4.065);
    });

    it("passes decoderConfig only with the very first video packet", async () => {
        mockVideoPackets.push(
            {
                data: new Uint8Array([1]),
                type: "key",
                timestamp: 0,
                duration: 0.04,
            },
            {
                data: new Uint8Array([2]),
                type: "delta",
                timestamp: 0.04,
                duration: 0.04,
            },
        );

        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);

        expect(mockVideoSource.add.mock.calls[0][1]).toMatchObject({
            decoderConfig: expect.objectContaining({ codec: "avc1.42001f" }),
        });
        expect(mockVideoSource.add.mock.calls[1]?.[1]).toBeUndefined();
    });

    it("closes video source after all clips are piped", async () => {
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        expect(mockVideoSource.close).toHaveBeenCalled();
    });

    it("closes audio source after all clips are piped", async () => {
        await service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]);
        expect(mockAudioSource.close).toHaveBeenCalled();
    });
});

// ─── Error cases ──────────────────────────────────────────────────────────────

describe("ConcatService — error cases", () => {
    it("throws when the first clip has no video track", async () => {
        mockInputConfig.hasVideoTrack = false;
        await expect(
            service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]),
        ).rejects.toThrow("no video track");
    });

    it("calls output.cancel() and propagates the error when mediabunny throws mid-concat", async () => {
        const { Input } = await import("mediabunny");
        const normalInput = {
            getPrimaryVideoTrack: vi.fn().mockResolvedValue({
                getDecoderConfig: vi.fn().mockResolvedValue({
                    codec: "avc1.42001f",
                    codedWidth: 1280,
                    codedHeight: 720,
                }),
            }),
            getPrimaryAudioTrack: vi.fn().mockResolvedValue(null),
            computeDuration: vi.fn().mockResolvedValue(4),
            getDurationFromMetadata: vi.fn().mockResolvedValue(4),
        };
        const errorInput = {
            getPrimaryVideoTrack: vi
                .fn()
                .mockRejectedValue(new Error("read error")),
            getPrimaryAudioTrack: vi.fn().mockResolvedValue(null),
            computeDuration: vi.fn().mockResolvedValue(4),
            getDurationFromMetadata: vi.fn().mockResolvedValue(4),
        };
        vi.mocked(Input)
            .mockImplementationOnce(function () {
                return normalInput as never;
            })
            .mockImplementationOnce(function () {
                return errorInput as never;
            });

        await expect(
            service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]),
        ).rejects.toThrow("read error");
        expect(mockOutput.cancel).toHaveBeenCalled();
    });

    it("calls output.cancel() when finalize throws", async () => {
        const { Output } = await import("mediabunny");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let capturedOutput: any = null;
        vi.mocked(Output).mockImplementationOnce(function () {
            const fakeOutput = {
                addVideoTrack: vi.fn(),
                addAudioTrack: vi.fn(),
                start: vi.fn().mockResolvedValue(undefined),
                finalize: vi
                    .fn()
                    .mockRejectedValue(new Error("finalize failed")),
                cancel: vi.fn().mockResolvedValue(undefined),
            };
            capturedOutput = fakeOutput;
            return fakeOutput as never;
        });

        await expect(
            service.concatVideos(["gs://bucket/a.mp4", "gs://bucket/b.mp4"]),
        ).rejects.toThrow("finalize failed");
        expect(capturedOutput?.cancel).toHaveBeenCalled();
    });
});
