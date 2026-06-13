import { Edge } from "@xyflow/react";
import { NodeData, NodeType, NamedNodeInput, MediaRef } from "../../types";

// --- Collection detection ---

/**
 * Returns true when the source node produced a collection (either a List node
 * or any node that ran in batch mode). Downstream gatherInputs uses this to
 * populate textValues / fileValuesList so the unfold engine can iterate.
 */
export function isCollectionSource(sourceData: NodeData | null): boolean {
    if (!sourceData) return false;
    if (sourceData.type === "list") return true;
    return !!(sourceData.batchTotal && sourceData.batchTotal > 0);
}

// --- Edge helpers ---

export const findInputByHandle = (
    nodeId: string,
    edges: Edge[],
    handle: string,
    getSourceData: (id: string, handle?: string | null) => NodeData | null,
): NodeData | null => {
    const edge = edges.find(
        (e) => e.target === nodeId && e.targetHandle === handle,
    );
    if (!edge) return null;
    return getSourceData(edge.source, edge.sourceHandle);
};

// --- Value extraction strategies ---

type ValueStrategy = (
    data: Record<string, unknown>,
    isBatch: boolean,
) => unknown;

/**
 * Strategy map: each node type provides its own output-value extraction logic.
 * This replaces a large if-else chain and allows new node types to register
 * their extraction strategy without modifying a central switch statement.
 */
const VALUE_STRATEGIES: Partial<Record<NodeType, ValueStrategy>> = {
    text: (data) => data.text,
    llm: (data, isBatch) => {
        if (isBatch && Array.isArray(data.outputs) && data.outputs.length > 1) {
            return data.outputs;
        }
        return data.output;
    },
    image: (data) => data.images,
    video: (data, isBatch) => {
        if (
            isBatch &&
            Array.isArray(data.videoUrls) &&
            data.videoUrls.length > 1
        ) {
            return data.videoUrls;
        }
        return data.videoUrl;
    },
    upscale: (data, isBatch) => {
        if (isBatch && Array.isArray(data.images) && data.images.length > 1) {
            return data.images;
        }
        return data.image;
    },
    resize: (data, isBatch) => {
        if (isBatch && Array.isArray(data.outputs) && data.outputs.length > 1) {
            return data.outputs;
        }
        return data.output;
    },
    list: (data) => data.items,
    file: (data) => data.gcsUri,
    router: (data) => data.value,
};

function unwrapEnvelope(data: NodeData): Record<string, unknown> {
    let d: Record<string, unknown> = data as Record<string, unknown>;
    while (d && d.value !== undefined && d.type === undefined) {
        d = d.value as Record<string, unknown>;
    }
    return d;
}

function extractWorkflowInputValue(d: Record<string, unknown>): unknown {
    const portType = d.portType;
    let value: unknown = null;

    if (portType === "text") {
        value = d.text || d.output;
    } else if (portType === "image") {
        value = d.images || d.image || d.gcsUri || d.fileUrl;
    } else if (portType === "video") {
        value = d.videoUrl || d.gcsUri || d.fileUrl;
    } else if (portType === "any") {
        value = d.image || d.videoUrl || d.output || d.gcsUri || d.fileUrl;
    }

    if (value === undefined || value === null) value = d.value;
    return value !== undefined && value !== null ? value : d.portDefaultValue;
}

export const getSourceValue = (data: NodeData | null): unknown => {
    if (!data) return null;

    const d = unwrapEnvelope(data);

    if (d.type === "workflow-output" && d.value !== undefined) {
        return getSourceValue(d.value as NodeData | null);
    }

    if (d.type === "workflow-input") {
        return extractWorkflowInputValue(d);
    }

    const isBatch = !!(d.batchTotal && (d.batchTotal as number) > 0);
    const strategy = VALUE_STRATEGIES[d.type as NodeType];
    if (strategy) {
        return strategy(d, isBatch);
    }

    // Fallback for direct values or results from other nodes
    const fallbackValue =
        d.images ||
        d.videoUrl ||
        d.output ||
        d.text ||
        d.image ||
        d.gcsUri ||
        d.value;

    if (fallbackValue !== undefined) return fallbackValue;

    // Object with no type field — raw value passed through sub-workflows
    if (typeof d === "object" && d !== null && !d.type) return d;

    return null;
};

// --- MIME type inference ---

/**
 * Infers MIME type for a URL string using extension and source node metadata.
 */
export function inferMimeType(
    url: string,
    sourceData: NodeData | null,
): string {
    const lower = url.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".webp")
    )
        return "image/png";
    if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "video/mp4";

    const meta = sourceData as Record<string, unknown> | null;
    if (meta) {
        if (meta.type === "router" && meta.valueMediaType) {
            if (meta.valueMediaType === "image") return "image/png";
            if (meta.valueMediaType === "video") return "video/mp4";
            if (meta.valueMediaType === "pdf") return "application/pdf";
        }
        if (meta.fileType === "pdf" || meta.portType === "pdf")
            return "application/pdf";
        if (
            meta.fileType === "image" ||
            meta.type === "image" ||
            meta.portType === "image" ||
            meta.type === "upscale" ||
            meta.type === "resize"
        )
            return "image/png";
        if (
            meta.fileType === "video" ||
            meta.type === "video" ||
            meta.portType === "video"
        )
            return "video/mp4";
    }

    return "application/octet-stream";
}

// --- File value builder ---

/**
 * Builds NamedNodeInput entries from an array of URL-like values and their source.
 */
export function buildFileValues(
    rawValues: unknown[],
    sourceData: NodeData | null,
): MediaRef[] {
    const result: MediaRef[] = [];
    for (const item of rawValues) {
        if (typeof item === "string") {
            result.push({
                url: item,
                type: inferMimeType(item, sourceData),
            });
        } else if (
            typeof item === "object" &&
            item !== null &&
            (item as Record<string, unknown>).url
        ) {
            const obj = item as Record<string, unknown>;
            result.push({
                url: obj.url as string,
                type: (obj.type as string) || "application/octet-stream",
            });
        }
    }
    return result;
}

// --- Named-node tracker factory ---

/**
 * Creates a per-gatherInputs tracker that deduplicates NamedNodeInput entries
 * by nodeId, avoiding repeated boilerplate across node gatherInputs functions.
 */
export function createNamedNodesTracker() {
    const map = new Map<string, NamedNodeInput>();

    function getOrCreate(nodeId: string, sourceData: NodeData): NamedNodeInput {
        if (!map.has(nodeId)) {
            map.set(nodeId, {
                nodeId,
                name: sourceData.name,
                textValue: null,
                fileValues: [],
            });
        }
        return map.get(nodeId)!;
    }

    function values(): NamedNodeInput[] {
        return Array.from(map.values());
    }

    return { getOrCreate, values };
}
