"use client";

import { useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { RulesetEditor } from "./ruleset-editor";
import type { RulesetDocument } from "@/lib/services/ruleset.service";
import type { Rule } from "@/lib/schemas";
import logger from "@/app/logger";

type Tab = "my" | "shared" | "community";

export function RulesetList() {
    const [tab, setTab] = useState<Tab>("my");
    const [rulesets, setRulesets] = useState<RulesetDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<RulesetDocument> | null>(
        null,
    );
    const [deleteTarget, setDeleteTarget] = useState<RulesetDocument | null>(
        null,
    );

    async function fetchRulesets(t: Tab) {
        setLoading(true);
        try {
            const res = await fetch(`/api/rulesets?tab=${t}`);
            if (!res.ok) throw new Error("Failed to fetch rulesets");
            const data = (await res.json()) as { rulesets: RulesetDocument[] };
            setRulesets(data.rulesets);
        } catch (err) {
            logger.error("[RulesetList] Fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setTimeout(() => {
            void fetchRulesets(tab);
        }, 0);
    }, [tab]);

    async function handleSave(data: {
        name: string;
        description?: string;
        rules: Rule[];
    }) {
        const url = editing?.id
            ? `/api/rulesets/${editing.id}`
            : "/api/rulesets";
        const method = editing?.id ? "PATCH" : "POST";
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Save failed");
        await fetchRulesets(tab);
    }

    async function handleDelete(ruleset: RulesetDocument) {
        try {
            const res = await fetch(`/api/rulesets/${ruleset.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Delete failed");
            setRulesets((prev) => prev.filter((r) => r.id !== ruleset.id));
        } catch (err) {
            logger.error("[RulesetList] Delete failed:", err);
        } finally {
            setDeleteTarget(null);
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rulesets</span>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                        setEditing(null);
                        setEditorOpen(true);
                    }}
                >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    New
                </Button>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList className="h-7 text-xs">
                    <TabsTrigger value="my" className="text-xs">
                        Mine
                    </TabsTrigger>
                    <TabsTrigger value="shared" className="text-xs">
                        Shared
                    </TabsTrigger>
                    <TabsTrigger value="community" className="text-xs">
                        Community
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {loading ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                </div>
            ) : rulesets.length === 0 ? (
                <div className="text-muted-foreground py-4 text-center text-xs">
                    No rulesets yet.
                </div>
            ) : (
                <div className="space-y-1.5">
                    {rulesets.map((ruleset) => (
                        <div
                            key={ruleset.id}
                            className="group hover:bg-muted/50 flex items-center justify-between rounded-md border px-2.5 py-2 transition-colors"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <ShieldCheck className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                <span className="truncate text-sm">
                                    {ruleset.name}
                                </span>
                                <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[10px]">
                                    {ruleset.rules.length} rule
                                    {ruleset.rules.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground p-1"
                                    onClick={() => {
                                        setEditing(ruleset);
                                        setEditorOpen(true);
                                    }}
                                    aria-label="Edit"
                                >
                                    <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-destructive p-1"
                                    onClick={() => setDeleteTarget(ruleset)}
                                    aria-label="Delete"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <RulesetEditor
                open={editorOpen}
                onOpenChange={setEditorOpen}
                initialRuleset={editing}
                onSave={handleSave}
            />

            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete ruleset?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete &quot;
                            {deleteTarget?.name}&quot;. This action cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() =>
                                deleteTarget && void handleDelete(deleteTarget)
                            }
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
