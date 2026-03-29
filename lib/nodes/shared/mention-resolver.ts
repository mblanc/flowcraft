import { ContentPart, NamedNodeInput } from "../../types";
import { NODE_MENTION_REGEX } from "@/lib/mention-utils";

export const MENTION_RE = NODE_MENTION_REGEX;

/**
 * Parses a string containing `@[nodeId]` tokens and returns a `ContentPart[]`
 * array with media parts interleaved at their exact positions.
 *
 * Text @-references are substituted inline into the surrounding text buffer so
 * that `"A story about @[id1] and @[id2]"` with two text nodes produces a
 * single `{ kind: "text", text: "A story about a cat and a duck" }` part
 * rather than four separate parts.
 *
 * File/media @-references flush the accumulated text buffer and insert the
 * appropriate URI or base64 Part at their exact position, enabling true
 * multimodal interleaving.
 *
 * IDs that are successfully resolved are added to `referencedIds`.
 */
export function resolveInlineMentions(
    text: string,
    namedNodes: NamedNodeInput[],
    referencedIds: Set<string>,
): ContentPart[] {
    const nodeMap = new Map(namedNodes.map((n) => [n.nodeId, n]));
    const parts: ContentPart[] = [];
    let currentText = "";
    let lastIndex = 0;

    MENTION_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MENTION_RE.exec(text)) !== null) {
        currentText += text.slice(lastIndex, match.index);

        const nodeId = match[1];
        const named = nodeMap.get(nodeId);

        if (named) {
            referencedIds.add(nodeId);
            if (named.fileValues.length > 0) {
                if (currentText) {
                    parts.push({ kind: "text", text: currentText });
                    currentText = "";
                }
                for (const fv of named.fileValues) {
                    if (fv.url.startsWith("gs://")) {
                        parts.push({
                            kind: "uri",
                            uri: fv.url,
                            mimeType: fv.type,
                        });
                    } else if (fv.url.startsWith("data:")) {
                        const m = fv.url.match(/^data:([^;]+);base64,(.+)$/);
                        if (m)
                            parts.push({
                                kind: "base64",
                                data: m[2],
                                mimeType: m[1],
                            });
                    }
                }
            } else if (named.textValue !== null) {
                currentText += named.textValue;
            }
        } else {
            currentText += match[0];
        }

        lastIndex = match.index + match[0].length;
    }

    currentText += text.slice(lastIndex);
    if (currentText) parts.push({ kind: "text", text: currentText });

    return parts;
}

/**
 * Appends Mode-1 (non-@-referenced) node values to the parts array.
 * All unreferenced text values are merged into a single text part; file
 * values are appended individually after.
 */
export function appendUnreferencedNodes(
    parts: ContentPart[],
    namedNodes: NamedNodeInput[],
    referencedIds: Set<string>,
): void {
    const textSegments: string[] = [];
    for (const n of namedNodes) {
        if (referencedIds.has(n.nodeId)) continue;
        if (n.textValue !== null) textSegments.push(n.textValue);
    }
    if (textSegments.length > 0) {
        parts.push({ kind: "text", text: textSegments.join("\n\n") });
    }
    for (const n of namedNodes) {
        if (referencedIds.has(n.nodeId)) continue;
        for (const fv of n.fileValues) {
            if (fv.url.startsWith("gs://")) {
                parts.push({ kind: "uri", uri: fv.url, mimeType: fv.type });
            } else if (fv.url.startsWith("data:")) {
                const m = fv.url.match(/^data:([^;]+);base64,(.+)$/);
                if (m)
                    parts.push({
                        kind: "base64",
                        data: m[2],
                        mimeType: m[1],
                    });
            }
        }
    }
}
