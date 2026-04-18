"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, PanelRight } from "lucide-react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserProfile } from "@/components/flow/user-profile";

export function CanvasHeader() {
    const router = useRouter();
    const canvasId = useCanvasStore((s) => s.canvasId);
    const canvasName = useCanvasStore((s) => s.canvasName);
    const setCanvasName = useCanvasStore((s) => s.setCanvasName);
    const saveStatus = useCanvasStore((s) => s.saveStatus);

    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(canvasName);

    useEffect(() => {
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
                <ThemeToggle />
                <UserProfile isCollapsed={false} />
            </div>
        </header>
    );
}
