"use client";

import { FlowsListView } from "@/components/flow/flows-list-view";

export default function FlowsPage() {
    return (
        <FlowsListView
            activeTab="my"
            title="Flows"
            description="Manage your custom visual workflows and reusable components"
        />
    );
}
