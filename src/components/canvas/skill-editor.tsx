"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Info, Sparkles, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import type { UserSkillDocument } from "@/lib/canvas/agent/skills/skill-types";
import logger from "@/app/logger";

interface SkillEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialSkill?: Partial<UserSkillDocument> | null;
    onSave: (data: {
        name: string;
        description: string;
        instructions: string;
    }) => Promise<void>;
}

export function SkillEditor({
    open,
    onOpenChange,
    initialSkill,
    onSave,
}: SkillEditorProps) {
    const isEdit = !!initialSkill?.id;

    // Form states
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [instructions, setInstructions] = useState("");
    const [activeTab, setActiveTab] = useState("write");

    // UI states
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<
        Record<string, string>
    >({});

    // Reset form when modal opens/closes or skill changes
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                setError(null);
                setValidationErrors({});
                setActiveTab("write");
                if (initialSkill) {
                    setName(initialSkill.name ?? "");
                    setDescription(initialSkill.description ?? "");
                    setInstructions(initialSkill.instructions ?? "");
                } else {
                    setName("");
                    setDescription("");
                    setInstructions(
                        "# Custom Skill Instructions\n\nUse this skill to guide the AI Director.\n\n### Rules\n- Rule 1: Always do X\n- Rule 2: Never do Y\n",
                    );
                }
            }, 0);
        }
    }, [open, initialSkill]);

    // Normalize name to kebab-case
    const handleNameChange = (val: string) => {
        const normalized = val
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "") // remove special characters
            .replace(/\s+/g, "-"); // spaces to hyphens
        setName(normalized);
        if (validationErrors.name) {
            setValidationErrors((prev) => {
                const copy = { ...prev };
                delete copy.name;
                return copy;
            });
        }
    };

    // Form validation
    const validateForm = (): boolean => {
        const errs: Record<string, string> = {};

        if (!name || name.trim().length < 2) {
            errs.name = "Name must be at least 2 characters.";
        }
        if (!description || description.trim().length < 10) {
            errs.description = "Description must be at least 10 characters.";
        }
        if (!instructions || instructions.trim().length < 10) {
            errs.instructions = "Instructions must be at least 10 characters.";
        }

        setValidationErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // Submit form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) return;

        setSaving(true);
        try {
            await onSave({
                name: name.trim(),
                description: description.trim(),
                instructions: instructions.trim(),
            });
            onOpenChange(false);
        } catch (err) {
            logger.error("Failed to save skill:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to save skill. Please try again.",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-background border-border max-h-[90vh] overflow-y-auto shadow-xl sm:max-w-[720px]">
                <DialogHeader>
                    <DialogTitle className="text-foreground flex items-center gap-2">
                        <Sparkles className="text-primary h-5 w-5" />
                        {isEdit
                            ? `Edit Skill: ${initialSkill?.name}`
                            : "Create Custom Skill"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                        Define custom workflows or design instructions matching
                        the
                        <span className="px-1 font-semibold">SKILL.md</span>
                        specification. The AI Director will automatically follow
                        these guidelines.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 py-2">
                    {/* Display Errors */}
                    {error && (
                        <div className="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Skill Name & Description Row */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Skill Name */}
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="skill-name"
                                className="text-foreground flex items-center gap-1 text-xs font-semibold"
                            >
                                Skill Name (Kebab-case){" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="skill-name"
                                value={name}
                                onChange={(e) =>
                                    handleNameChange(e.target.value)
                                }
                                placeholder="e.g. logo-campaign"
                                disabled={isEdit || saving}
                                className={`bg-muted/30 border-border h-9 text-xs ${
                                    validationErrors.name
                                        ? "border-destructive focus-visible:ring-destructive"
                                        : ""
                                }`}
                            />
                            {validationErrors.name ? (
                                <p className="text-destructive text-[10px]">
                                    {validationErrors.name}
                                </p>
                            ) : (
                                <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                                    <Info className="h-3 w-3 shrink-0" />{" "}
                                    Command trigger:{" "}
                                    <code>/{name || "name"}</code>
                                </p>
                            )}
                        </div>

                        {/* Skill Description */}
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="skill-desc"
                                className="text-foreground text-xs font-semibold"
                            >
                                Description{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="skill-desc"
                                value={description}
                                onChange={(e) => {
                                    setDescription(e.target.value);
                                    if (validationErrors.description) {
                                        setValidationErrors((prev) => {
                                            const copy = { ...prev };
                                            delete copy.description;
                                            return copy;
                                        });
                                    }
                                }}
                                placeholder="e.g. Standard 3-shot layout sequence"
                                disabled={saving}
                                className={`bg-muted/30 border-border h-9 text-xs ${
                                    validationErrors.description
                                        ? "border-destructive focus-visible:ring-destructive"
                                        : ""
                                }`}
                            />
                            {validationErrors.description && (
                                <p className="text-destructive text-[10px]">
                                    {validationErrors.description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Skill Instructions (Markdown Editor) */}
                    <div className="space-y-2">
                        <Label className="text-foreground text-xs font-semibold">
                            Instructions (Supports Markdown){" "}
                            <span className="text-destructive">*</span>
                        </Label>

                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="border-border/60 overflow-hidden rounded-xl border"
                        >
                            <div className="bg-muted/30 border-border/60 flex items-center justify-between border-b px-4 py-1.5">
                                <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                                    SKILL.md Instructions
                                </span>
                                <TabsList className="bg-muted/60 h-7 rounded-md p-0.5">
                                    <TabsTrigger
                                        value="write"
                                        className="h-6 gap-1 rounded-sm px-2.5 text-[11px]"
                                    >
                                        <Edit3 className="size-3" />
                                        Write
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="preview"
                                        className="h-6 gap-1 rounded-sm px-2.5 text-[11px]"
                                    >
                                        <Eye className="size-3" />
                                        Preview
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent
                                value="write"
                                className="m-0 border-none"
                            >
                                <Textarea
                                    value={instructions}
                                    onChange={(e) => {
                                        setInstructions(e.target.value);
                                        if (validationErrors.instructions) {
                                            setValidationErrors((prev) => {
                                                const copy = { ...prev };
                                                delete copy.instructions;
                                                return copy;
                                            });
                                        }
                                    }}
                                    placeholder="# System Instructions&#10;&#10;Specify your workflow rules here in clear markdown. For example:&#10;- Ensure character consistency by referencing the first node.&#10;- Always render cinematic close-ups with neon lights."
                                    disabled={saving}
                                    className="min-h-[300px] resize-y rounded-none border-none bg-transparent p-4 font-mono text-xs leading-relaxed focus-visible:ring-0"
                                />
                            </TabsContent>

                            <TabsContent
                                value="preview"
                                className="bg-muted/5 m-0 max-h-[450px] min-h-[300px] overflow-y-auto border-none p-5"
                            >
                                {instructions.trim() ? (
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed break-words">
                                        <ReactMarkdown>
                                            {instructions}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-xs italic">
                                        Nothing to preview yet. Write some
                                        markdown!
                                    </p>
                                )}
                            </TabsContent>
                        </Tabs>
                        {validationErrors.instructions && (
                            <p className="text-destructive text-[10px]">
                                {validationErrors.instructions}
                            </p>
                        )}
                    </div>

                    {/* Footer */}
                    <DialogFooter className="border-border/20 border-t pt-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                            className="text-muted-foreground hover:text-foreground h-9 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 gap-1.5 px-4 text-xs font-medium shadow-sm"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                    Saving...
                                </>
                            ) : (
                                "Save Skill"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
