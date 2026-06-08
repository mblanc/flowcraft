/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeDefinition } from "@/lib/types";
import { Primitive } from "./types";

export function toNodeDefinition(p: Primitive): NodeDefinition<any, any> {
    if (!p.flow) {
        throw new Error(`Primitive ${p.id} has no flow surface`);
    }

    return {
        type: p.flow.type,
        inputs: p.flow.inputs,
        outputs: p.flow.outputs,
        gatherInputs: p.flow.gatherInputs,
        defaultData: p.flow.defaultData,
        getSourcePortType: p.flow.getSourcePortType,
        getTargetPortType: p.flow.getTargetPortType,
        execute: async (node, inputs, context) => {
            const payload = { ...inputs };

            // Primitives without requestSchema either run locally or are pure pass-throughs.
            if (!p.requestSchema) {
                // Pure pass-throughs (text, file, list, workflow-input): no execute needed.
                if (!p.execute) return {};
                // Local primitives (router, workflow-output, custom-workflow): call directly.
                const userId = (context as any)?.userId ?? "";
                const result = await p.execute(payload, { userId });
                if (p.flow?.toFlowData) {
                    return p.flow.toFlowData(node, inputs, result);
                }
                return result;
            }

            // Server-side primitives (with requestSchema): always call via HTTP.
            // execute may be null on the client; the real implementation runs server-side.

            // Server-side primitives (llm, image, video, upscale, resize): call via HTTP.
            const fetcher = context?.fetch || fetch;

            if (p.id === "llm") {
                const { resolveInlineMentions, appendUnreferencedNodes } =
                    await import("@/lib/node-adapters/utils/mention-resolver");

                if (node?.data) {
                    payload.instructions =
                        payload.instructions !== undefined
                            ? payload.instructions
                            : node.data.instructions;
                    payload.model =
                        payload.model !== undefined
                            ? payload.model
                            : node.data.model;
                    payload.outputType =
                        payload.outputType !== undefined
                            ? payload.outputType
                            : node.data.outputType;
                    payload.responseSchema =
                        payload.responseSchema !== undefined
                            ? payload.responseSchema
                            : node.data.responseSchema;
                    payload.strictMode =
                        payload.strictMode !== undefined
                            ? payload.strictMode
                            : node.data.strictMode;
                    payload.thinkingLevel =
                        payload.thinkingLevel !== undefined
                            ? payload.thinkingLevel
                            : node.data.thinkingLevel;
                }

                if (!payload.parts || payload.parts.length === 0) {
                    const namedNodes = payload.namedNodes || [];
                    const instructions = payload.instructions || "";
                    const referencedIds = new Set<string>();

                    const resolvedParts = resolveInlineMentions(
                        instructions,
                        namedNodes,
                        referencedIds,
                    );
                    appendUnreferencedNodes(
                        resolvedParts,
                        namedNodes,
                        referencedIds,
                    );

                    if (payload.prompts && payload.prompts.length > 0) {
                        const unreferencedPrompts = payload.prompts.filter(
                            (pr: string) =>
                                !namedNodes.some(
                                    (n: any) => n.textValue === pr,
                                ),
                        );
                        if (unreferencedPrompts.length > 0) {
                            resolvedParts.push({
                                kind: "text",
                                text: unreferencedPrompts.join("\n\n"),
                            });
                        }
                    }

                    payload.parts = resolvedParts;
                }

                if (!payload.parts || payload.parts.length === 0) {
                    throw new Error("No prompt available for LLM node");
                }
            }

            if (p.id === "image" || p.id === "video") {
                if (!payload.prompt || payload.prompt.length === 0) {
                    const namedNodes: any[] = payload.namedNodes || [];
                    const textValues = namedNodes
                        .map((n: any) => n.textValue)
                        .filter(Boolean);
                    if (textValues.length > 0) {
                        payload.prompt = textValues.join("\n\n");
                    }
                }
            }

            const response = await fetcher(`/api/primitives/${p.id}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Failed to execute primitive ${p.id}: ${errorText}`,
                );
            }

            const result = await response.json();

            if (p.flow?.toFlowData) {
                return p.flow.toFlowData(node, inputs, result);
            }

            return result;
        },
    };
}
