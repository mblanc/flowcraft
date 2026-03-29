"use client";

import { useState, useEffect } from "react";
import { FlowUpdateRequest } from "@/lib/schemas";
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
import logger from "@/app/logger";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

const DEFAULT_SHARED_WITH: { email: string; role: "view" | "edit" }[] = [];

export function ShareFlowModal({
    isOpen,
    onClose,
    flowId,
    flowName,
    initialVisibility = "private",
    initialSharedWith = DEFAULT_SHARED_WITH,
    isOwner,
    isAdmin = false,
    initialIsTemplate = false,
}: ShareFlowModalProps) {
    // session is currently unused in the component body
    // const { data: session } = useSession();
    const [visibility, setVisibility] = useState(initialVisibility);
    const [sharedWith, setSharedWith] = useState(initialSharedWith);
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState<"view" | "edit">("view");
    const [isTemplate, setIsTemplate] = useState(initialIsTemplate);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisibility(initialVisibility);
            setSharedWith(initialSharedWith);
            setIsTemplate(initialIsTemplate);
        }
    }, [isOpen, initialVisibility, initialSharedWith, initialIsTemplate]);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/flow/${flowId}`;
        void navigator.clipboard.writeText(url);
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
            const updatePayload: FlowUpdateRequest = {
                visibility,
                sharedWith,
            };

            // Update template status if admin and owner
            if (isAdmin && isOwner) {
                updatePayload.isTemplate = isTemplate;
            }

            const response = await fetch(`/api/flows/${flowId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to save sharing settings",
                );
            }

            toast.success("Sharing settings updated");
            onClose();
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Internal server error";
            logger.error("Error saving share settings:", error);
            toast.error(message || "Failed to update sharing settings");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Share Flow</DialogTitle>
                    <DialogDescription>
                        Manage who can see and edit &quot;{flowName}&quot;
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
                            onValueChange={(
                                val: "private" | "public" | "restricted",
                            ) => setVisibility(val)}
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
                                <SelectItem value="restricted">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        <span>
                                            Restricted (Only shared users)
                                        </span>
                                    </div>
                                </SelectItem>
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

                    {/* Explicit Sharing */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">
                            Share with people
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter email address"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
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
                                    <SelectItem value="view">View</SelectItem>
                                    <SelectItem value="edit">Edit</SelectItem>
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

                    {/* Link Sharing Utility */}
                    <div className="flex items-center justify-between gap-4 py-2">
                        <div className="flex-1">
                            <p className="text-xs font-medium">Link Access</p>
                            <p className="text-muted-foreground text-[10px]">
                                {visibility === "public"
                                    ? "Anyone with the link can view this flow."
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

                    {/* Admin Section: Publish to Community */}
                    {isAdmin && isOwner && (
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">
                                        Publish to Community
                                    </Label>
                                    <p className="text-muted-foreground text-xs">
                                        Make this flow available as a template
                                        for all users.
                                    </p>
                                </div>
                                <Switch
                                    checked={isTemplate}
                                    onCheckedChange={(checked) => {
                                        setIsTemplate(checked);
                                        if (checked) {
                                            setVisibility("public");
                                        }
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
