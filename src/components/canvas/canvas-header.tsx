"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, PanelRight, Share2 } from "lucide-react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserProfile } from "@/components/flow/user-profile";
import { ShareDialog } from "@/components/sharing/ShareDialog";

export function CanvasHeader() {
    const router = useRouter();
    const { data: session } = useSession();
    const canvasId = useCanvasStore((s) => s.canvasId);
    const canvasUserId = useCanvasStore((s) => s.canvasUserId);
    const canvasName = useCanvasStore((s) => s.canvasName);
    const canvasVisibility = useCanvasStore((s) => s.canvasVisibility);
    const canvasSharedWith = useCanvasStore((s) => s.canvasSharedWith);
    const canvasIsTemplate = useCanvasStore((s) => s.canvasIsTemplate);
    const setCanvasName = useCanvasStore((s) => s.setCanvasName);
    const saveStatus = useCanvasStore((s) => s.saveStatus);

    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(canvasName);
    const [shareOpen, setShareOpen] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEditedName(canvasName);
    }, [canvasName]);

    const handleSaveName = () => {
        const trimmed = editedName.trim();
        if (trimmed) {
            setCanvasName(trimmed);
        } else {
            setEditedName(canvasName);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditedName(canvasName);
        setIsEditing(false);
    };

    const handleBack = () => {
        router.push("/agents");
    };

    const statusLabel =
        saveStatus === "saving"
            ? "Saving..."
            : saveStatus === "error"
              ? "Error saving"
              : "Saved";

    const statusColor =
        saveStatus === "saving"
            ? "text-muted-foreground"
            : saveStatus === "error"
              ? "text-destructive"
              : "text-muted-foreground";

    return (
        <header className="border-border bg-background flex h-14 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
                {canvasId && (
                    <Button variant="ghost" size="sm" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                )}
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-md">
                        <PanelRight className="text-primary h-4 w-4" />
                    </div>
                    {canvasId ? (
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
                                        onBlur={handleSaveName}
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
                                    className="text-foreground hover:text-primary cursor-pointer text-lg font-semibold transition-colors"
                                    onClick={() => setIsEditing(true)}
                                >
                                    {canvasName}
                                </h1>
                            )}
                        </div>
                    ) : (
                        <h1 className="text-foreground text-lg font-semibold">
                            Canvas
                        </h1>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {canvasId && (
                    <span className={`text-xs ${statusColor}`}>
                        {statusLabel}
                    </span>
                )}
                {canvasId && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShareOpen(true)}
                    >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                    </Button>
                )}
                <ThemeToggle />
                <UserProfile isCollapsed={false} />
            </div>

            {canvasId && (
                <ShareDialog
                    isOpen={shareOpen}
                    onClose={() => setShareOpen(false)}
                    artifactType="canvas"
                    artifactId={canvasId}
                    artifactName={canvasName}
                    currentVisibility={canvasVisibility}
                    sharedWith={canvasSharedWith}
                    isTemplate={canvasIsTemplate}
                    isOwner={canvasUserId === session?.user?.id}
                    isAdmin={false}
                />
            )}
        </header>
    );
}
