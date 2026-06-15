"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Globe,
    Lock,
    Users,
    Copy,
    Check,
    Mail,
    Trash2,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import logger from "@/app/logger";

export type ArtifactType = "flow" | "canvas" | "style" | "asset";

type Visibility = "private" | "public" | "restricted";
type SharedEntry = { email: string; role: "view" | "edit" };

export interface ShareDialogProps {
    isOpen: boolean;
    onClose: () => void;
    artifactType: ArtifactType;
    artifactId: string;
    artifactName: string;
    currentVisibility?: Visibility;
    sharedWith?: SharedEntry[];
    isTemplate?: boolean;
    isOwner: boolean;
    isAdmin?: boolean;
    onSaved?: () => void;
}

const DEFAULT_SHARED: SharedEntry[] = [];

const TYPE_LABEL: Record<ArtifactType, string> = {
    flow: "Flow",
    canvas: "Canvas",
    style: "Style",
    asset: "Asset",
};

const API_BASE: Record<ArtifactType, string> = {
    flow: "/api/flows",
    canvas: "/api/canvases",
    style: "/api/styles",
    asset: "/api/library",
};

function apiPath(type: ArtifactType, id: string) {
    return `${API_BASE[type]}/${id}`;
}

export function ShareDialog({
    isOpen,
    onClose,
    artifactType,
    artifactId,
    artifactName,
    currentVisibility = "private",
    sharedWith: initialSharedWith = DEFAULT_SHARED,
    isTemplate: initialIsTemplate = false,
    isOwner,
    isAdmin = false,
    onSaved,
}: ShareDialogProps) {
    const supportsInvites = artifactType !== "asset";
    const supportsCommunity = artifactType !== "asset";
    // flows also support "restricted" visibility
    const supportsRestricted = artifactType === "flow";

    const [visibility, setVisibility] = useState<Visibility>(currentVisibility);
    const [sharedWith, setSharedWith] =
        useState<SharedEntry[]>(initialSharedWith);
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState<"view" | "edit">("view");
    const [isTemplate, setIsTemplate] = useState(initialIsTemplate);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setVisibility(currentVisibility);
            setSharedWith(initialSharedWith);
            setIsTemplate(initialIsTemplate);
        }
    }, [isOpen, currentVisibility, initialSharedWith, initialIsTemplate]);

    const handleCopyLink = () => {
        const paths: Record<ArtifactType, string> = {
            flow: `/flow/${artifactId}`,
            canvas: `/canvas/${artifactId}`,
            style: `/styles/${artifactId}`,
            asset: `/assets/${artifactId}`,
        };
        void navigator.clipboard.writeText(
            `${window.location.origin}${paths[artifactType]}`,
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Link copied to clipboard");
    };

    const handleAddUser = () => {
        if (!newEmail || !newEmail.includes("@")) {
            toast.error("Please enter a valid email");
            return;
        }
        if (sharedWith.some((u) => u.email === newEmail)) {
            toast.error("User already added");
            return;
        }
        setSharedWith([...sharedWith, { email: newEmail, role: newRole }]);
        setNewEmail("");
    };

    const handleRemoveUser = (email: string) => {
        setSharedWith(sharedWith.filter((u) => u.email !== email));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const body: Record<string, unknown> = { visibility };

            if (supportsInvites) {
                body.sharedWith = sharedWith;
            }

            if (supportsCommunity && isAdmin && isOwner) {
                body.isTemplate = isTemplate;
            }

            const method = artifactType === "style" ? "PUT" : "PATCH";
            const response = await fetch(apiPath(artifactType, artifactId), {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to save sharing settings");
            }

            toast.success("Sharing settings updated");
            onSaved?.();
            onClose();
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Internal server error";
            logger.error("Error saving share settings:", error);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Share {TYPE_LABEL[artifactType]}</DialogTitle>
                    <DialogDescription>
                        Manage who can see and edit &quot;{artifactName}&quot;
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* General Access */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">
                            General Access
                        </Label>
                        <Select
                            value={visibility}
                            onValueChange={(val: Visibility) =>
                                setVisibility(val)
                            }
                            disabled={!isOwner}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="private">
                                    <div className="flex items-center gap-2">
                                        <Lock className="h-4 w-4" />
                                        <span>Private (Only you)</span>
                                    </div>
                                </SelectItem>
                                {supportsRestricted && (
                                    <SelectItem value="restricted">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <span>
                                                Restricted (Only shared users)
                                            </span>
                                        </div>
                                    </SelectItem>
                                )}
                                <SelectItem value="public">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4" />
                                        <span>
                                            Public (Anyone with link can view)
                                        </span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Email invites */}
                    {supportsInvites && (
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">
                                Share with people
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter email address"
                                    value={newEmail}
                                    onChange={(e) =>
                                        setNewEmail(e.target.value)
                                    }
                                    disabled={!isOwner}
                                    className="flex-1"
                                />
                                <Select
                                    value={newRole}
                                    onValueChange={(val: "view" | "edit") =>
                                        setNewRole(val)
                                    }
                                    disabled={!isOwner}
                                >
                                    <SelectTrigger className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="view">
                                            View
                                        </SelectItem>
                                        <SelectItem value="edit">
                                            Edit
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={handleAddUser}
                                    disabled={!isOwner || !newEmail}
                                    variant="outline"
                                >
                                    Add
                                </Button>
                            </div>

                            <div className="bg-muted/30 max-h-[150px] overflow-y-auto rounded-md border text-sm">
                                {sharedWith.length === 0 ? (
                                    <div className="text-muted-foreground p-3 text-center italic">
                                        No one else has access yet
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {sharedWith.map((user) => (
                                            <div
                                                key={user.email}
                                                className="flex items-center justify-between p-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Mail className="text-muted-foreground h-3 w-3" />
                                                    <span className="truncate">
                                                        {user.email}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground text-xs capitalize">
                                                        {user.role}
                                                    </span>
                                                    {isOwner && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() =>
                                                                handleRemoveUser(
                                                                    user.email,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Copy link */}
                    <div className="flex items-center justify-between gap-4 py-2">
                        <div className="flex-1">
                            <p className="text-xs font-medium">Link Access</p>
                            <p className="text-muted-foreground text-[10px]">
                                {visibility === "public"
                                    ? `Anyone with the link can view this ${TYPE_LABEL[artifactType].toLowerCase()}.`
                                    : "Only people shared with can access via link."}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyLink}
                            className="shrink-0"
                        >
                            {copied ? (
                                <Check className="mr-2 h-3 w-3 text-green-500" />
                            ) : (
                                <Copy className="mr-2 h-3 w-3" />
                            )}
                            Copy Link
                        </Button>
                    </div>

                    {/* Community toggle (admin only) */}
                    {supportsCommunity && isAdmin && isOwner && (
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">
                                        Publish to Community
                                    </Label>
                                    <p className="text-muted-foreground text-xs">
                                        Make this{" "}
                                        {TYPE_LABEL[artifactType].toLowerCase()}{" "}
                                        available as a template for all users.
                                    </p>
                                </div>
                                <Switch
                                    checked={isTemplate}
                                    onCheckedChange={(checked) => {
                                        setIsTemplate(checked);
                                        if (checked) setVisibility("public");
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    {isOwner && (
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
