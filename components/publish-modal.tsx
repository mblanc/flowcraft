"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface PublishModalProps {
    flowId: string;
    onBeforePublish?: () => Promise<void>;
}

export function PublishModal({ flowId, onBeforePublish }: PublishModalProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handlePublish = async () => {
        setLoading(true);
        try {
            if (onBeforePublish) {
                await onBeforePublish();
            }
            const res = await fetch(`/api/flows/${flowId}/publish`, {
                method: "POST",
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to publish");
            }

            toast.success(`Published version ${data.version}`);
            setOpen(false);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to publish",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Publish
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Publish Workflow</DialogTitle>
                    <DialogDescription>
                        Publishing creates an immutable version of this workflow
                        that can be used as a sub-graph in other workflows.
                        Ensure you have defined at least one Input and one
                        Output node.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {/* Placeholder for future metadata inputs */}
                    <p className="text-muted-foreground text-sm">
                        Ready to publish?
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handlePublish} disabled={loading}>
                        {loading ? "Publishing..." : "Publish Now"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
