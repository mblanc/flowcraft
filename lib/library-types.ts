export type LibraryAssetType = "image" | "video";

export interface LibraryAssetProvenance {
    sourceType: "flow" | "canvas";
    sourceId: string;
    sourceName: string;
    nodeId?: string;
    nodeLabel?: string;
    prompt?: string;
    mediaInputs?: { url: string; mimeType?: string }[];
}

export interface LibraryAsset {
    id: string;
    userId: string;
    type: LibraryAssetType;
    gcsUri: string;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
    aspectRatio?: string;
    model?: string;
    tags: string[];
    provenance: LibraryAssetProvenance;
    createdAt: string;
}
