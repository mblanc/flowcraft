"use client";

import type { StateCreator } from "zustand";
import type { FlowState, UISlice } from "./types";

export const createUISlice: StateCreator<FlowState, [], [], UISlice> = (
    set,
) => ({
    isConfigSidebarOpen: false,
    setIsConfigSidebarOpen: (isConfigSidebarOpen) =>
        set({ isConfigSidebarOpen }),
});
