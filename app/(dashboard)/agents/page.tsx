"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function AgentsPage() {
    return (
        <FlowsListView
            activeTab="canvas"
            title="Agents (Canvas)"
            description="Collaborative canvas sessions for agent-driven media creation"
        />
    );
}
