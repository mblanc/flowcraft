"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function CommunityCanvasesPage() {
    return (
        <FlowsListView
            activeTab="canvas-community"
            title="Community Canvases"
            description="Discover and clone canvas templates shared by the community"
        />
    );
}
