/* eslint-disable @typescript-eslint/no-explicit-any */
import { geminiService } from "@/lib/services/gemini.service";
import { GenerateVideoSchema } from "@/lib/schemas";
import { z } from "zod";
import { NODE_MENTION_REGEX } from "@/lib/utils/mention";
import {
    resolveInlineMentions,
    appendUnreferencedNodes,
} from "@/lib/node-adapters/utils/mention-resolver";

type VideoRequest = z.infer<typeof GenerateVideoSchema> & {
    parts?: any;
    namedNodes?: any[];
};
type VideoResult = { videoUrl: string; interactionId?: string };

export async function videoExecute(
    inputs: VideoRequest,
    _ctx: { userId: string },
): Promise<VideoResult> {
    let parts = inputs.parts;
    let prompt = inputs.prompt;
    if (
        (!parts || parts.length === 0) &&
        prompt &&
        inputs.namedNodes &&
        inputs.namedNodes.length > 0
    ) {
        const referencedIds = new Set<string>();
        const resolvedParts = resolveInlineMentions(
            prompt,
            inputs.namedNodes,
            referencedIds,
        );
        appendUnreferencedNodes(
            resolvedParts,
            inputs.namedNodes,
            referencedIds,
        );
        parts = resolvedParts;

        const nodeMap = new Map(
            inputs.namedNodes.map((n: any) => [n.nodeId, n]),
        );
        NODE_MENTION_REGEX.lastIndex = 0;
        prompt = prompt.replace(NODE_MENTION_REGEX, (match, nodeId) => {
            const named = nodeMap.get(nodeId);
            return named?.textValue ?? named?.name ?? match;
        });

        const unreferencedText = inputs.namedNodes
            .filter(
                (n: any) =>
                    !referencedIds.has(n.nodeId) &&
                    n.textValue !== null &&
                    n.textValue !== undefined,
            )
            .map((n: any) => n.textValue);
        if (unreferencedText.length > 0) {
            prompt = [prompt, ...unreferencedText].filter(Boolean).join("\n\n");
        }
    }

    const res = await geminiService.generateVideo({
        ...inputs,
        prompt,
        parts,
    });

    if (typeof res === "string") {
        return { videoUrl: res };
    }

    return res;
}
