"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import type {
    CanvasImageData,
    CanvasVideoData,
    GenerationStep,
    AgentPlan,
} from "@/lib/canvas-types";

export function useRegenerateNode(nodeId: string) {
    const canvasId = useCanvasStore((s) => s.canvasId);
    const updateNodeData = useCanvasStore((s) => s.updateNodeData);
    const abortRef = useRef<AbortController | null>(null);

    const regenerate = useCallback(async () => {
        const store = useCanvasStore.getState();
        const node = store.nodes.find((n) => n.id === nodeId);
        if (!node || !canvasId) return;

        const d = node.data as CanvasImageData | CanvasVideoData;
        if (!d.prompt) {
            toast.error("No prompt saved — cannot regenerate");
            return;
        }

        abortRef.current?.abort();
        const abort = new AbortController();
        abortRef.current = abort;

        updateNodeData(nodeId, {
            status: "generating",
            error: undefined,
            ...(node.type === "canvas-video" ? { progress: 0 } : {}),
        });

        const stepId = uuidv4();
        const step: GenerationStep = {
            id: stepId,
            type: node.type === "canvas-image" ? "image" : "video",
            prompt: d.prompt,
            label: d.label,
            aspectRatio: d.aspectRatio,
            model: d.model,
            referenceNodeIds: d.referenceNodeIds,
            ...(node.type === "canvas-video"
                ? { duration: (d as CanvasVideoData).duration }
                : {}),
        };
        const plan: AgentPlan = { steps: [step] };
        const messageId = `regen_${uuidv4()}`;

        try {
            const res = await fetch(`/api/canvases/${canvasId}/execute-plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, messageId }),
                signal: abort.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Request failed (${res.status})`);
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No response stream");

            const decoder = new TextDecoder();
            let buffer = "";

            outer: while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const blocks = buffer.split("\n\n");
                buffer = blocks.pop() ?? "";

                for (const block of blocks) {
                    if (!block.trim()) continue;
                    let event = "";
                    let data = "";
                    for (const line of block.split("\n")) {
                        if (line.startsWith("event: ")) event = line.slice(7);
                        else if (line.startsWith("data: ")) data = line.slice(6);
                    }
                    if (!event || !data) continue;

                    const payload = JSON.parse(data);
                    if (event === "step_done") {
                        useCanvasStore.getState().updateNodeData(nodeId, {
                            sourceUrl: payload.node.sourceUrl,
                            mimeType: payload.node.mimeType,
                            status: "ready",
                            ...(node.type === "canvas-video"
                                ? { progress: 100 }
                                : {}),
                        });
                        break outer;
                    } else if (event === "step_error" || event === "error") {
                        throw new Error(payload.message || "Generation failed");
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") return;
            const msg =
                err instanceof Error ? err.message : "Regeneration failed";
            useCanvasStore.getState().updateNodeData(nodeId, {
                status: "error",
                error: msg,
            });
            toast.error(msg);
        }
    }, [nodeId, canvasId, updateNodeData]);

    return { regenerate };
}
