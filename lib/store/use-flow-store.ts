/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createGraphSlice } from "./graph-slice";
import { createUISlice } from "./ui-slice";

// Re-export all public types so existing import paths remain unchanged.
export type {
    EntityType,
    FlowState,
    GraphSlice,
    UISlice,
    SharedWith,
    SharingData,
} from "./types";

export const useFlowStore = create<import("./types").FlowState>()(
    persist(
        (...a) => ({
            ...createGraphSlice(...a),
            ...createUISlice(...a),
        }),
        {
            name: "flow-storage",
            // Only persist essential graph state – never transient UI flags like isRunning
            // We also strip node-specific transient flags (executing, etc.) to prevent
            // the UI from being stuck in a loading state after hydration.
            partialize: (state) => {
                const cleanNode = (node: any) => {
                    const {
                        executing,
                        batchProgress,
                        batchTotal,
                        ...cleanData
                    } = node.data;
                    return { ...node, data: cleanData };
                };

                return {
                    nodes: state.nodes.map(cleanNode),
                    nodesById: Object.fromEntries(
                        Object.entries(state.nodesById).map(([id, node]) => [
                            id,
                            cleanNode(node),
                        ]),
                    ),
                    edges: state.edges,
                    selectedNodeId: state.selectedNodeId,
                    selectedNode: state.selectedNode
                        ? cleanNode(state.selectedNode)
                        : null,
                    flowId: state.flowId,
                    flowName: state.flowName,
                    entityType: state.entityType,
                    visibility: state.visibility,
                    sharedWith: state.sharedWith,
                    isTemplate: state.isTemplate,
                    ownerId: state.ownerId,
                };
            },
        },
    ),
);
