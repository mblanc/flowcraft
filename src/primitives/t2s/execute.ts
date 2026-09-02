import { geminiService } from "@/lib/services/gemini.service";
import { storageService } from "@/lib/services/storage.service";
import { v4 as uuidv4 } from "uuid";
import { MODELS } from "@/lib/constants";

type T2SRequest = {
    prompt: string;
    voice?: string;
    model?: string;
};

type T2SResult = { audioUrl: string; mimeType: string };

const MIME_TO_EXT: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/l16": "wav",
};

/**
 * Wraps raw 16-bit PCM audio data in a standard 44-byte RIFF WAV header
 * so HTML5 <audio> elements in browsers can play it natively.
 */
export function pcmToWav(
    pcmBuffer: Buffer,
    sampleRate = 24000,
    numChannels = 1,
    bitsPerSample = 16,
): Buffer {
    const header = Buffer.alloc(44);
    const dataLength = pcmBuffer.length;
    const fileLength = 36 + dataLength;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;

    // RIFF header
    header.write("RIFF", 0);
    header.writeUInt32LE(fileLength, 4);
    header.write("WAVE", 8);

    // fmt subchunk
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 for Linear PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data subchunk
    header.write("data", 36);
    header.writeUInt32LE(dataLength, 40);

    return Buffer.concat([header, pcmBuffer]);
}

export async function t2sExecute(
    inputs: T2SRequest,
    _ctx: { userId: string },
): Promise<T2SResult> {
    const { audioData, mimeType } = await geminiService.generateSpeech({
        prompt: inputs.prompt,
        voice: inputs.voice,
        model: inputs.model ?? MODELS.AUDIO.GEMINI_3_1_FLASH_TTS_PREVIEW,
    });

    if (!audioData) {
        throw new Error("Gemini speech generation returned empty audio data");
    }

    const rawBuffer = Buffer.from(audioData, "base64");
    const cleanMime = (mimeType ?? "audio/wav")
        .split(";")[0]
        .trim()
        .toLowerCase();

    let audioBuffer: Buffer = rawBuffer;
    let finalMime = cleanMime;
    let extension = MIME_TO_EXT[cleanMime] || "wav";

    // Gemini TTS returns raw uncontainerized PCM (audio/l16).
    // Wrap it in a 44-byte RIFF WAV header so browsers can play it natively via <audio controls>.
    if (cleanMime === "audio/l16" || mimeType?.includes("l16")) {
        const rateMatch = mimeType?.match(/rate=(\d+)/i);
        const channelsMatch = mimeType?.match(/channels=(\d+)/i);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        const numChannels = channelsMatch ? parseInt(channelsMatch[1], 10) : 1;

        audioBuffer = pcmToWav(rawBuffer, sampleRate, numChannels);
        finalMime = "audio/wav";
        extension = "wav";
    }

    const audioGcsUri = await storageService.uploadFile(
        audioBuffer,
        `speech-${uuidv4()}.${extension}`,
        finalMime,
    );

    return { audioUrl: audioGcsUri, mimeType: finalMime };
}
