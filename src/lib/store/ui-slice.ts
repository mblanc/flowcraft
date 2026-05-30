"use client";

import type { StateCreator } from "zustand";
import type { FlowState, UISlice } from "./types";

export const createUISlice: StateCreator<FlowState, [], [], UISlice> = (
    set,
) => ({
    isRunning: false,
    isConfigSidebarOpen: false,
    setIsRunning: (isRunning) => set({ isRunning }),
    setIsConfigSidebarOpen: (isConfigSidebarOpen) =>
        set({ isConfigSidebarOpen }),
});
