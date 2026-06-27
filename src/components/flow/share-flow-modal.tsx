"use client";

import { ShareDialog } from "@/components/sharing/ShareDialog";

interface ShareFlowModalProps {
    isOpen: boolean;
    onClose: () => void;
    flowId: string;
    flowName: string;
    initialVisibility?: "private" | "public" | "restricted";
    initialSharedWith?: { email: string; role: "view" | "edit" }[];
    isOwner: boolean;
    isAdmin?: boolean;
    initialIsTemplate?: boolean;
}

export function ShareFlowModal({
    isOpen,
    onClose,
    flowId,
    flowName,
    initialVisibility = "private",
    initialSharedWith = [],
    isOwner,
    isAdmin = false,
    initialIsTemplate = false,
}: ShareFlowModalProps) {
    return (
        <ShareDialog
            isOpen={isOpen}
            onClose={onClose}
            artifactType="flow"
            artifactId={flowId}
            artifactName={flowName}
            currentVisibility={initialVisibility}
            sharedWith={initialSharedWith}
            isTemplate={initialIsTemplate}
            isOwner={isOwner}
            isAdmin={isAdmin}
        />
    );
}
