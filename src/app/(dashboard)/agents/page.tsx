"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function AgentsPage() {
    return (
        <FlowsListView
            activeTab="canvas"
            title="Agents"
            description="Collaborative canvas for agent-driven media"
        />
    );
}
