export const NODE_MENTION_REGEX = /@\[([^\]]+)\]/g;

export interface NodeMentionMatch {
    raw: string;
    nodeId: string;
    index: number;
}

export function parseNodeMentions(value: string): NodeMentionMatch[] {
    NODE_MENTION_REGEX.lastIndex = 0;
    const matches: NodeMentionMatch[] = [];
    let match: RegExpExecArray | null;

    while ((match = NODE_MENTION_REGEX.exec(value)) !== null) {
        matches.push({
            raw: match[0],
            nodeId: match[1],
            index: match.index,
        });
    }

    return matches;
}
