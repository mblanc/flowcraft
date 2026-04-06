"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function SharedPage() {
    return (
        <FlowsListView
            activeTab="shared"
            title="Shared with Me"
            description="View and access workflows that have been shared with you"
        />
    );
}
