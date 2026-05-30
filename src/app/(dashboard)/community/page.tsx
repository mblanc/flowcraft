"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function CommunityPage() {
    return (
        <FlowsListView
            activeTab="community"
            title="Community"
            description="Discover and use workflow templates shared by the community"
        />
    );
}
