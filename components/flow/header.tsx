"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Download,
    Upload,
    ArrowLeft,
    Save,
    Box,
    Workflow,
    Users,
    Copy,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowPersistence } from "@/hooks/use-flow-persistence";
import { UserProfile } from "./user-profile";
import { ThemeToggle } from "../ui/theme-toggle";
import { ShareFlowModal } from "./share-flow-modal";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function Header() {
    const { data: session } = useSession();
    const { exportFlow, importFlow, saveFlow } = useFlowPersistence();
    const flowId = useFlowStore((state) => state.flowId);
    const flowName = useFlowStore((state) => state.flowName);
    const setFlowName = useFlowStore((state) => state.setFlowName);
    const entityType = useFlowStore((state) => state.entityType);
    const ownerId = useFlowStore((state) => state.ownerId);
    const sharedWith = useFlowStore((state) => state.sharedWith);
    const isTemplate = useFlowStore((state) => state.isTemplate);
    const visibility = useFlowStore((state) => state.visibility);

    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(flowName);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isCloning, setIsCloning] = useState(false);

    const isCustomNode = entityType === "custom-node";
    const isAdmin = session?.user?.isAdmin || false;
    const isOwner =
        !!session?.user?.id && !!ownerId && session.user.id === ownerId;
    const isEditor =
        !!session?.user?.email &&
        sharedWith?.some(
            (s) => s.email === session.user?.email && s.role === "edit",
        );
    const isEditable = isOwner || isEditor;

    useEffect(() => {
        setEditedName(flowName);
    }, [flowName]);

    const handleSaveName = async () => {
        setFlowName(editedName);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditedName(flowName);
        setIsEditing(false);
    };

    const handleBack = async () => {
        await saveFlow();
        router.push("/flows");
    };

    const handleClone = async () => {
        if (!flowId) return;
        setIsCloning(true);
        try {
            const response = await fetch(`/api/flows/${flowId}/clone`, {
                method: "POST",
            });
            if (response.ok) {
                const newFlow = await response.json();
                toast.success("Flow cloned successfully");
                router.push(`/flow/${newFlow.id}`);
            } else {
                toast.error("Failed to clone flow");
            }
        } catch (error) {
            console.error("Error cloning flow:", error);
            toast.error("Error cloning flow");
        } finally {
            setIsCloning(false);
        }
    };

    return (
        <header className="border-border bg-background flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
                {flowId && (
                    <Button variant="ghost" size="sm" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                )}
                <div className="flex items-center gap-2">
                    <div
                        className={`flex h-8 w-8 items-center justify-center rounded-md ${isCustomNode ? "bg-purple-500" : "bg-primary"}`}
                    >
                        {isCustomNode ? (
                            <Box className="h-4 w-4 text-white" />
                        ) : (
                            <Workflow className="text-primary-foreground h-4 w-4" />
                        )}
                    </div>
                    {flowId ? (
                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={editedName}
                                        onChange={(e) =>
                                            setEditedName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                handleSaveName();
                                            if (e.key === "Escape")
                                                handleCancelEdit();
                                        }}
                                        className="h-8 w-48"
                                        autoFocus
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleSaveName}
                                    >
                                        <Save className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <h1
                                    className={`text-foreground text-lg font-semibold transition-colors ${isEditable ? "hover:text-primary cursor-pointer" : ""}`}
                                    onClick={() =>
                                        isEditable && setIsEditing(true)
                                    }
                                >
                                    {flowName}
                                </h1>
                            )}
                        </div>
                    ) : (
                        <h1 className="text-foreground text-lg font-semibold">
                            FlowCraft
                        </h1>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {flowId && !isCustomNode && isOwner && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsShareModalOpen(true)}
                    >
                        <Users className="mr-2 h-4 w-4" />
                        Share
                    </Button>
                )}
                {flowId && isEditable && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                                await saveFlow();
                                toast.success("Flow saved successfully");
                            }}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                        </Button>
                    </>
                )}
                {flowId && !isEditable && (
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleClone}
                        disabled={isCloning}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        <Copy className="mr-2 h-4 w-4" />
                        {isCloning ? "Cloning..." : "Remix"}
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={importFlow}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                </Button>
                {flowId && (
                    <Button variant="ghost" size="sm" onClick={exportFlow}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                )}
                <ThemeToggle />
                <UserProfile isCollapsed={false} />
            </div>

            {flowId && (
                <ShareFlowModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    flowId={flowId}
                    flowName={flowName}
                    initialVisibility={visibility || undefined}
                    initialSharedWith={sharedWith}
                    isOwner={isOwner}
                    isAdmin={isAdmin}
                    initialIsTemplate={isTemplate}
                />
            )}
        </header>
    );
}
