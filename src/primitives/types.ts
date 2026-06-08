/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";

export interface ServerContext {
    userId: string;
}

export interface LibrarySaveContext {
    userId: string;
    flowId: string;
    flowName?: string;
    fetch: typeof fetch;
}

export interface Primitive<
    TFlowData = any,
    TCanvasData = any,
    TRequest = any,
    TOutput = any,
> {
    // Identity
    id: string; // e.g., "image", "video", "music" — must match existing Firestore type strings
    label: string; // e.g., "Image Generation"
    mediaType: "image" | "video" | "audio" | "text" | "any" | null;

    // Schemas
    requestSchema: z.ZodType<TRequest> | null;
    outputShape: z.ZodType<TOutput> | null;

    // Server-side execution
    execute:
        | ((inputs: TRequest, ctx: ServerContext) => Promise<TOutput>)
        | null;

    // Flow surface (server-safe: no React/client imports)
    flow: {
        type: string; // e.g., "image" — must match Firestore NodeType strings
        inputs: Record<string, string>;
        outputs: Record<string, string>;
        gatherInputs: (
            node: any,
            edges: any[],
            getSourceData: (id: string, handle?: string | null) => any,
        ) => TRequest;
        toFlowData?: (
            node: any,
            inputs: TRequest,
            result: TOutput,
        ) => Partial<TFlowData>;
        mergeResults: (results: Partial<TFlowData>[]) => Partial<TFlowData>;
        saveToLibrary: (
            node: any,
            result: TOutput,
            ctx: LibrarySaveContext,
        ) => Promise<void>;
        defaultData?: Partial<TFlowData>;
        getSourcePortType?: (node: any, handleId?: string | null) => string;
        getTargetPortType?: (node: any, handleId?: string | null) => string;
    } | null;

    // Canvas surface (server-safe: no React/client imports)
    canvas: {
        type: string; // e.g., "canvas-image" — must match Firestore canvas node type strings
        toCanvasData: (step: any, result: TOutput) => TCanvasData;
        toRequest: (step: any, ctx: ServerContext) => TRequest;
    } | null;

    // Agent surface
    agent: {
        skillPath: string | null;
        operationId: string; // e.g., "t2i", "i2v" — must match historical Firestore chat strings
    } | null;
}
