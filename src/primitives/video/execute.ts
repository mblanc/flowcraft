/* eslint-disable @typescript-eslint/no-explicit-any */
import { geminiService } from "@/lib/services/gemini.service";
import { GenerateVideoSchema } from "@/lib/schemas";
import { z } from "zod";
import { NODE_MENTION_REGEX } from "@/lib/utils/mention";

type VideoRequest = z.infer<typeof GenerateVideoSchema> & {
    namedNodes?: any[];
};
type VideoResult = { videoUrl: string; interactionId?: string };

export async function videoExecute(
    inputs: VideoRequest,
    _ctx: { userId: string },
): Promise<VideoResult> {
    let prompt = inputs.prompt;
    if (inputs.namedNodes && prompt) {
        const nodeMap = new Map(
            inputs.namedNodes.map((n: any) => [n.nodeId, n]),
        );
        NODE_MENTION_REGEX.lastIndex = 0;
        prompt = prompt.replace(NODE_MENTION_REGEX, (match, nodeId) => {
            const named = nodeMap.get(nodeId);
            return named?.textValue ?? match;
        });
    }

    const res = await geminiService.generateVideo({
        ...inputs,
        prompt,
    });

    if (typeof res === "string") {
        return { videoUrl: res };
    }

    return res;
}
