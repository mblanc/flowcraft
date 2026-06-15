"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function SharedCanvasesPage() {
    return (
        <FlowsListView
            activeTab="canvas-shared"
            title="Shared Canvases"
            description="Canvases shared with you by your team"
        />
    );
}
