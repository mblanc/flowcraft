import { createPartFromText, createPartFromUri } from "@google/genai";
import type { Content } from "@google/genai";
import type { AgentInput } from "../agent";

export function buildUserContent(input: AgentInput): Content {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];

    if (input.attachments && input.attachments.length > 0) {
        const labels: string[] = [];
        for (const att of input.attachments) {
            const node = input.canvasNodes.find((n) => n.id === att.nodeId);
            if (!node) continue;
            if (
                node.type === "canvas-text" &&
                "content" in node.data &&
                node.data.content
            ) {
                labels.push(`[${att.label} (id: ${att.nodeId}, type: text)]`);
                parts.push(
                    createPartFromText(
                        `Content of "${att.label}":\n${(node.data.content as string).trim()}`,
                    ),
                );
            } else if ("sourceUrl" in node.data && node.data.sourceUrl) {
                const src = node.data.sourceUrl as string;
                if (src.startsWith("gs://")) {
                    const mime =
                        ("mimeType" in node.data
                            ? (node.data.mimeType as string)
                            : null) ||
                        (node.type === "canvas-video"
                            ? "video/mp4"
                            : "image/png");
                    labels.push(
                        `[${att.label} (id: ${att.nodeId}, type: ${node.type.replace("canvas-", "")})]`,
                    );
                    parts.push(createPartFromUri(src, mime));
                }
            }
        }
        if (labels.length > 0) {
            parts.unshift(
                createPartFromText(
                    `The user shared these canvas items: ${labels.join(", ")}. Media files follow.`,
                ),
            );
        }
    }

    parts.push(createPartFromText(input.message));
    return { role: "user", parts };
}
