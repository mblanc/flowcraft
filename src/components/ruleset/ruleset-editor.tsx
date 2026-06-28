"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { RulesetDocument } from "@/lib/services/ruleset.service";
import type { Rule } from "@/lib/schemas";
import logger from "@/app/logger";

interface RulesetEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialRuleset?: Partial<RulesetDocument> | null;
    onSave: (data: {
        name: string;
        description?: string;
        rules: Rule[];
    }) => Promise<void>;
}

function emptyRule(): Rule {
    return {
        id: uuidv4(),
        description: "",
        severity: "hard",
        failureStrategy: "surface",
    };
}

export function RulesetEditor({
    open,
    onOpenChange,
    initialRuleset,
    onSave,
}: RulesetEditorProps) {
    const isEdit = !!initialRuleset?.id;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [rules, setRules] = useState<Rule[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [prevOpen, setPrevOpen] = useState(open);
    const [prevInitial, setPrevInitial] = useState(initialRuleset);

    if (open !== prevOpen || initialRuleset !== prevInitial) {
        setPrevOpen(open);
        setPrevInitial(initialRuleset);
        if (open) {
            setName(initialRuleset?.name ?? "");
            setDescription(initialRuleset?.description ?? "");
            setRules(
                initialRuleset?.rules?.length
                    ? initialRuleset.rules
                    : [emptyRule()],
            );
            setError(null);
            setSaving(false);
        }
    }

    function addRule() {
        setRules((prev) => [...prev, emptyRule()]);
    }

    function removeRule(id: string) {
        setRules((prev) => prev.filter((r) => r.id !== id));
    }

    function updateRule<K extends keyof Rule>(
        id: string,
        key: K,
        value: Rule[K],
    ) {
        setRules((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        const filledRules = rules.filter((r) => r.description.trim());
        setSaving(true);
        setError(null);
        try {
            await onSave({
                name: name.trim(),
                description: description.trim() || undefined,
                rules: filledRules,
            });
            onOpenChange(false);
        } catch (err) {
            logger.error("[RulesetEditor] Save failed:", err);
            setError("Failed to save ruleset. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Edit Ruleset" : "New Ruleset"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="ruleset-name">Name</Label>
                        <Input
                            id="ruleset-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Brand Guidelines"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="ruleset-desc">
                            Description{" "}
                            <span className="text-muted-foreground font-normal">
                                (optional)
                            </span>
                        </Label>
                        <Textarea
                            id="ruleset-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what this ruleset enforces…"
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Rules</Label>
                        <div className="space-y-3">
                            {rules.map((rule, i) => (
                                <div
                                    key={rule.id}
                                    className="space-y-2 rounded-md border p-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground text-xs font-medium">
                                            Rule {i + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeRule(rule.id)}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                            aria-label="Remove rule"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>

                                    <Textarea
                                        value={rule.description}
                                        onChange={(e) =>
                                            updateRule(
                                                rule.id,
                                                "description",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Logo must appear in the top-right quadrant"
                                        rows={2}
                                        className="text-sm"
                                    />

                                    <div className="flex gap-2">
                                        <Select
                                            value={rule.severity}
                                            onValueChange={(v) =>
                                                updateRule(
                                                    rule.id,
                                                    "severity",
                                                    v as Rule["severity"],
                                                )
                                            }
                                        >
                                            <SelectTrigger className="h-7 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="hard">
                                                    Hard (blocking)
                                                </SelectItem>
                                                <SelectItem value="soft">
                                                    Soft (warning)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select
                                            value={rule.failureStrategy}
                                            onValueChange={(v) =>
                                                updateRule(
                                                    rule.id,
                                                    "failureStrategy",
                                                    v as Rule["failureStrategy"],
                                                )
                                            }
                                        >
                                            <SelectTrigger className="h-7 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="surface">
                                                    Surface failure
                                                </SelectItem>
                                                <SelectItem value="retry">
                                                    Auto-retry
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {rule.failureStrategy === "retry" && (
                                            <Input
                                                type="number"
                                                min={1}
                                                max={5}
                                                value={rule.maxRetries ?? 1}
                                                onChange={(e) => {
                                                    const n = parseInt(
                                                        e.target.value,
                                                        10,
                                                    );
                                                    updateRule(
                                                        rule.id,
                                                        "maxRetries",
                                                        Number.isNaN(n)
                                                            ? undefined
                                                            : n,
                                                    );
                                                }}
                                                className="h-7 w-16 text-xs"
                                                placeholder="1"
                                                title="Max retries"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRule}
                            className="w-full"
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add Rule
                        </Button>
                    </div>

                    {error && (
                        <p className="text-destructive text-sm">{error}</p>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            {isEdit ? "Save Changes" : "Create Ruleset"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
