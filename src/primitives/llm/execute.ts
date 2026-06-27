/* eslint-disable @typescript-eslint/no-explicit-any */
import { geminiService } from "@/lib/services/gemini.service";
import { GenerateTextSchema } from "@/lib/schemas";
import { z } from "zod";
import {
    resolveInlineMentions,
    appendUnreferencedNodes,
} from "@/lib/node-adapters/utils/mention-resolver";

type LLMRequest = z.infer<typeof GenerateTextSchema> & {
    parts?: any;
    namedNodes?: any[];
    instructions?: string;
};
type LLMResult = { text: unknown };

export async function llmExecute(
    inputs: LLMRequest,
    _ctx: { userId: string },
): Promise<LLMResult> {
    let parts = inputs.parts;
    if (!parts || parts.length === 0) {
        const { namedNodes = [], instructions = "" } = inputs;
        const referencedIds = new Set<string>();

        const resolvedParts = resolveInlineMentions(
            instructions,
            namedNodes,
            referencedIds,
        );

        appendUnreferencedNodes(resolvedParts, namedNodes, referencedIds);
        parts = resolvedParts;
    }

    if (!parts || parts.length === 0) {
        throw new Error("No prompt available for LLM node");
    }

    const text = await geminiService.generateText({
        ...inputs,
        parts,
    });

    return { text };
}
