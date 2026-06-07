import { randomUUID } from "crypto";
import { storageService } from "./storage.service";
import logger from "@/app/logger";

// Mediabunny and its server extension are loaded lazily on first use.
// This prevents Next.js from bundling the @mediabunny/server module at
// build time, which would fail because node-av ships a native .node addon
// that webpack cannot process. serverExternalPackages in next.config.ts
// marks these packages as external, but the dynamic import here guarantees
// they are only required when the route handler actually executes.

let serverRegistered = false;

async function loadMediabunny() {
    if (!serverRegistered) {
        const { registerMediabunnyServer } = await import("@mediabunny/server");
        registerMediabunnyServer();
        serverRegistered = true;
    }
    return import("mediabunny");
}

type VideoCodec = import("mediabunny").VideoCodec;
type AudioCodec = import("mediabunny").AudioCodec;

function videoCodecId(codecString: string): VideoCodec {
    if (codecString.startsWith("avc")) return "avc";
    if (codecString.startsWith("hvc") || codecString.startsWith("hev"))
        return "hevc";
    if (codecString.startsWith("vp09") || codecString.startsWith("vp9"))
        return "vp9";
    if (codecString.startsWith("vp08")) return "vp8";
    if (codecString.startsWith("av01")) return "av1";
    throw new Error(`[ConcatService] Unrecognized video codec: ${codecString}`);
}

function audioCodecId(codecString: string): AudioCodec {
    if (codecString.startsWith("mp4a") || codecString.startsWith("aac"))
        return "aac";
    if (codecString.startsWith("opus")) return "opus";
    if (codecString.startsWith("mp3") || codecString.startsWith("mp4a.69"))
        return "mp3";
    if (codecString.startsWith("vorbis")) return "vorbis";
    if (codecString.startsWith("flac")) return "flac";
    if (codecString.startsWith("ac-3") || codecString.startsWith("ac3"))
        return "ac3";
    if (codecString.startsWith("ec-3") || codecString.startsWith("eac3"))
        return "eac3";
    throw new Error(`[ConcatService] Unrecognized audio codec: ${codecString}`);
}

export class ConcatService {
    /**
     * Concatenate an ordered list of GCS video URIs into a single MP4.
     * Pure transmux — no decode/re-encode; timestamps are offset per clip.
     * Muxes into an in-memory BufferTarget (no file handles) then uploads to GCS.
     * Returns the gs:// URI of the resulting file.
     */
    async concatVideos(gcsUris: string[]): Promise<string> {
        if (gcsUris.length === 0) {
            throw new Error("[ConcatService] At least one input URI required");
        }
        if (gcsUris.length === 1) {
            return gcsUris[0];
        }

        const buffer = await this.buildBuffer(gcsUris);
        const filename = `concat-${randomUUID()}.mp4`;
        const gcsUri = await storageService.uploadFile(
            Buffer.from(buffer),
            filename,
            "video/mp4",
        );
        logger.info(`[ConcatService] ${gcsUris.length} clips → ${gcsUri}`);
        return gcsUri;
    }

    private async buildBuffer(gcsUris: string[]): Promise<ArrayBuffer> {
        const {
            ALL_FORMATS,
            BufferTarget,
            EncodedAudioPacketSource,
            EncodedPacket,
            EncodedPacketSink,
            EncodedVideoPacketSource,
            Input,
            Mp4OutputFormat,
            Output,
            UrlSource,
        } = await loadMediabunny();

        // Resolve GCS URIs → signed HTTPS URLs mediabunny can fetch lazily
        const signedUrls = await Promise.all(
            gcsUris.map((uri) => storageService.getSignedUrl(uri)),
        );

        const inputs = signedUrls.map(
            (url) =>
                new Input({
                    source: new UrlSource(url),
                    formats: ALL_FORMATS,
                }),
        );

        // Read codec metadata from the first clip to configure output tracks
        const firstVideoTrack = await inputs[0].getPrimaryVideoTrack();
        if (!firstVideoTrack) {
            throw new Error("[ConcatService] First clip has no video track");
        }
        const firstAudioTrack = await inputs[0].getPrimaryAudioTrack();

        const videoConfig = await firstVideoTrack.getDecoderConfig();
        if (!videoConfig) {
            throw new Error(
                "[ConcatService] Could not read video decoder config from first clip",
            );
        }
        const audioConfig = firstAudioTrack
            ? await firstAudioTrack.getDecoderConfig()
            : null;

        const videoSource = new EncodedVideoPacketSource(
            videoCodecId(videoConfig.codec),
        );
        const audioSource = audioConfig
            ? new EncodedAudioPacketSource(audioCodecId(audioConfig.codec))
            : null;

        // BufferTarget holds the output entirely in memory — no file handles,
        // no GC-related FileHandle errors. fastStart "in-memory" pairs naturally
        // with an in-memory target and places moov at the front of the output.
        const target = new BufferTarget();
        const output = new Output({
            format: new Mp4OutputFormat({ fastStart: "in-memory" }),
            target,
        });

        output.addVideoTrack(videoSource);
        if (audioSource) output.addAudioTrack(audioSource);
        await output.start();

        try {
            let timeOffset = 0;

            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];

                const videoTrack = await input.getPrimaryVideoTrack();
                if (!videoTrack) {
                    logger.warn(
                        `[ConcatService] Clip ${i + 1} has no video track — skipping`,
                    );
                    continue;
                }
                const audioTrack = audioSource
                    ? await input.getPrimaryAudioTrack()
                    : null;

                const clipDuration =
                    (await input.computeDuration()) ??
                    (await input.getDurationFromMetadata()) ??
                    0;

                // Pipe video packets with timestamp offset
                const videoSink = new EncodedPacketSink(videoTrack);
                let isFirstVideoPacket = i === 0;
                for await (const packet of videoSink.packets()) {
                    const shifted = new EncodedPacket(
                        packet.data,
                        packet.type,
                        packet.timestamp + timeOffset,
                        packet.duration,
                    );
                    if (isFirstVideoPacket) {
                        await videoSource.add(shifted, {
                            decoderConfig: videoConfig,
                        });
                        isFirstVideoPacket = false;
                    } else {
                        await videoSource.add(shifted);
                    }
                }

                // Pipe audio packets with timestamp offset (if present)
                if (audioTrack && audioSource && audioConfig) {
                    const audioSink = new EncodedPacketSink(audioTrack);
                    let isFirstAudioPacket = i === 0;
                    for await (const packet of audioSink.packets()) {
                        const shifted = new EncodedPacket(
                            packet.data,
                            packet.type,
                            packet.timestamp + timeOffset,
                            packet.duration,
                        );
                        if (isFirstAudioPacket) {
                            await audioSource.add(shifted, {
                                decoderConfig: audioConfig,
                            });
                            isFirstAudioPacket = false;
                        } else {
                            await audioSource.add(shifted);
                        }
                    }
                }

                timeOffset += clipDuration;
                logger.debug(
                    `[ConcatService] Clip ${i + 1}/${inputs.length} piped, duration=${clipDuration.toFixed(3)}s`,
                );
            }

            videoSource.close();
            audioSource?.close();
            await output.finalize();
        } catch (err) {
            await output.cancel().catch(() => {});
            throw err;
        }

        return target.buffer!;
    }
}

export const concatService = new ConcatService();
