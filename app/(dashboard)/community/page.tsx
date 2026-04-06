"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function CommunityPage() {
    return (
        <FlowsListView
            activeTab="community"
            title="Community"
            description="Explore and discover workflow templates shared by the community"
        />
    );
}
