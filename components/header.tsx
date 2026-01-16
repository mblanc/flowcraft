"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload, ArrowLeft, Save } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { useFlowPersistence } from "@/hooks/use-flow-persistence";
import { UserProfile } from "./user-profile";

export function Header() {
    const { exportFlow, importFlow, saveFlow } = useFlowPersistence();
    const flowId = useFlowStore((state) => state.flowId);
    const flowName = useFlowStore((state) => state.flowName);
    const setFlowName = useFlowStore((state) => state.setFlowName);
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(flowName);

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

    // New handler function to Save then Navigate
    const handleBack = async () => {
        await saveFlow(); // Wait for the save operation to finish
        router.push("/flows");
    };

    return (
        <header className="border-border bg-card flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
                {flowId && (
                    <Button variant="ghost" size="sm" onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                )}
                <div className="flex items-center gap-2">
                    <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-md">
                        <span className="text-primary-foreground text-sm font-bold">
                            F
                        </span>
                    </div>
                    {flowId ? (
                        isEditing ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editedName}
                                    onChange={(e) =>
                                        setEditedName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveName();
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
                                className="text-foreground hover:text-primary cursor-pointer text-lg font-semibold transition-colors"
                                onClick={() => setIsEditing(true)}
                            >
                                {flowName}
                            </h1>
                        )
                    ) : (
                        <h1 className="text-foreground text-lg font-semibold">
                            FlowCraft
                        </h1>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {flowId && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => saveFlow()}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Save
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
                <UserProfile isCollapsed={false} />
            </div>
        </header>
    );
}
