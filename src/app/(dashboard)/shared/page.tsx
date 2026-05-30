"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function SharedPage() {
    return (
        <FlowsListView
            activeTab="shared"
            title="Shared with me"
            description="Workflows shared with you by your team"
        />
    );
}
