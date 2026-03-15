"use client";

import { create } from "zustand";
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

export const useFlowStore = create<import("./types").FlowState>()((...a) => ({
    ...createGraphSlice(...a),
    ...createUISlice(...a),
}));
