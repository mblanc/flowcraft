import { describe, it, expect } from "vitest";
import {
    resolveInlineMentions,
    appendUnreferencedNodes,
} from "../lib/nodes/shared/mention-resolver";
import type { NamedNodeInput } from "../lib/types";

function makeNamed(
    nodeId: string,
    opts: Partial<NamedNodeInput> = {},
): NamedNodeInput {
    return {
        nodeId,
        name: opts.name ?? nodeId,
        textValue: opts.textValue ?? null,
        fileValues: opts.fileValues ?? [],
        ...opts,
    };
}

describe("resolveInlineMentions", () => {
    it("returns plain text when there are no mentions", () => {
        const parts = resolveInlineMentions("hello world", [], new Set());
        expect(parts).toEqual([{ kind: "text", text: "hello world" }]);
    });

    it("returns empty array for empty string with no mentions", () => {
        const parts = resolveInlineMentions("", [], new Set());
        expect(parts).toEqual([]);
    });

    it("substitutes a text mention inline", () => {
        const named = makeNamed("n1", { textValue: "Alice" });
        const parts = resolveInlineMentions("Hello @[n1]!", [named], new Set());
        expect(parts).toEqual([{ kind: "text", text: "Hello Alice!" }]);
    });

    it("keeps unresolved mention as literal text", () => {
        const parts = resolveInlineMentions("Say @[unknown]", [], new Set());
        expect(parts).toEqual([{ kind: "text", text: "Say @[unknown]" }]);
    });

    it("inserts a gs:// URI part for file values", () => {
        const named = makeNamed("n1", {
            fileValues: [{ url: "gs://bucket/img.png", type: "image/png" }],
        });
        const parts = resolveInlineMentions("See @[n1]", [named], new Set());
        expect(parts).toContainEqual({
            kind: "uri",
            uri: "gs://bucket/img.png",
            mimeType: "image/png",
        });
    });

    it("flushes accumulated text before inserting a URI part", () => {
        const named = makeNamed("n1", {
            fileValues: [{ url: "gs://bucket/f.mp4", type: "video/mp4" }],
        });
        const parts = resolveInlineMentions("Intro @[n1]", [named], new Set());
        expect(parts[0]).toEqual({ kind: "text", text: "Intro " });
        expect(parts[1]).toEqual({
            kind: "uri",
            uri: "gs://bucket/f.mp4",
            mimeType: "video/mp4",
        });
    });

    it("inserts a base64 part for data: URI file values", () => {
        const named = makeNamed("n1", {
            fileValues: [
                {
                    url: "data:image/png;base64,abc123",
                    type: "image/png",
                },
            ],
        });
        const parts = resolveInlineMentions("@[n1]", [named], new Set());
        expect(parts).toContainEqual({
            kind: "base64",
            data: "abc123",
            mimeType: "image/png",
        });
    });

    it("adds resolved node IDs to referencedIds", () => {
        const named = makeNamed("n1", { textValue: "foo" });
        const refs = new Set<string>();
        resolveInlineMentions("@[n1]", [named], refs);
        expect(refs.has("n1")).toBe(true);
    });

    it("does not add unresolved IDs to referencedIds", () => {
        const refs = new Set<string>();
        resolveInlineMentions("@[ghost]", [], refs);
        expect(refs.size).toBe(0);
    });

    it("appends trailing text after last mention", () => {
        const named = makeNamed("n1", { textValue: "X" });
        const parts = resolveInlineMentions("@[n1] suffix", [named], new Set());
        expect(parts).toEqual([{ kind: "text", text: "X suffix" }]);
    });
});

describe("appendUnreferencedNodes", () => {
    it("does nothing when all nodes are already referenced", () => {
        const parts: ReturnType<typeof resolveInlineMentions> = [];
        const named = makeNamed("n1", { textValue: "hi" });
        appendUnreferencedNodes(parts, [named], new Set(["n1"]));
        expect(parts).toHaveLength(0);
    });

    it("appends text values for unreferenced text nodes", () => {
        const parts: ReturnType<typeof resolveInlineMentions> = [];
        const named = makeNamed("n1", { textValue: "hello" });
        appendUnreferencedNodes(parts, [named], new Set());
        expect(parts).toContainEqual({ kind: "text", text: "hello" });
    });

    it("merges multiple unreferenced text values with double newline", () => {
        const parts: ReturnType<typeof resolveInlineMentions> = [];
        const a = makeNamed("a", { textValue: "foo" });
        const b = makeNamed("b", { textValue: "bar" });
        appendUnreferencedNodes(parts, [a, b], new Set());
        expect(parts[0]).toEqual({ kind: "text", text: "foo\n\nbar" });
    });

    it("appends gs:// file values for unreferenced nodes", () => {
        const parts: ReturnType<typeof resolveInlineMentions> = [];
        const named = makeNamed("n1", {
            fileValues: [{ url: "gs://b/img.png", type: "image/png" }],
        });
        appendUnreferencedNodes(parts, [named], new Set());
        expect(parts).toContainEqual({
            kind: "uri",
            uri: "gs://b/img.png",
            mimeType: "image/png",
        });
    });

    it("appends base64 file values for unreferenced nodes", () => {
        const parts: ReturnType<typeof resolveInlineMentions> = [];
        const named = makeNamed("n1", {
            fileValues: [
                { url: "data:image/png;base64,xyz", type: "image/png" },
            ],
        });
        appendUnreferencedNodes(parts, [named], new Set());
        expect(parts).toContainEqual({
            kind: "base64",
            data: "xyz",
            mimeType: "image/png",
        });
    });

    it("skips nodes with null textValue and no fileValues", () => {
        const parts: ReturnType<typeof resolveInlineMentions> = [];
        const named = makeNamed("n1");
        appendUnreferencedNodes(parts, [named], new Set());
        expect(parts).toHaveLength(0);
    });
});
