"use client";

import { useEffect, useState } from "react";
import {
    X,
    Plus,
    Trash2,
    Loader2,
    Play,
    AlertCircle,
    Info,
    Sparkles,
} from "lucide-react";
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
import type {
    UserSkillDocument,
    SkillPhase,
} from "@/lib/canvas/agent/skills/skill-types";
import logger from "@/app/logger";

interface SkillEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    skill: UserSkillDocument | null;
    onSave: () => void;
}

export function SkillEditor({
    open,
    onOpenChange,
    skill,
    onSave,
}: SkillEditorProps) {
    const isEdit = !!skill;

    // Form states
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [triggerHints, setTriggerHints] = useState<string[]>([]);
    const [hintInput, setHintInput] = useState("");
    const [phases, setPhases] = useState<SkillPhase[]>([
        { title: "", rules: "" },
    ]);

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
                if (skill) {
                    setName(skill.name);
                    setDescription(skill.description);
                    setTriggerHints(skill.triggerHints);
                    setPhases(skill.phases);
                } else {
                    setName("");
                    setDescription("");
                    setTriggerHints([]);
                    setPhases([{ title: "Phase 1: Concept", rules: "" }]);
                }
                setHintInput("");
            }, 0);
        }
    }, [open, skill]);

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

    // Trigger Hints Tags Input
    const handleAddHint = () => {
        const trimmed = hintInput
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "");
        if (trimmed && !triggerHints.includes(trimmed)) {
            setTriggerHints([...triggerHints, trimmed]);
            setHintInput("");
            if (validationErrors.triggerHints) {
                setValidationErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.triggerHints;
                    return copy;
                });
            }
        }
    };

    const handleKeyDownHint = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            handleAddHint();
        }
    };

    const handleRemoveHint = (hintToRemove: string) => {
        setTriggerHints(triggerHints.filter((h) => h !== hintToRemove));
    };

    // Phases dynamic array actions
    const handleAddPhase = () => {
        const nextNum = phases.length + 1;
        setPhases([...phases, { title: `Phase ${nextNum}: `, rules: "" }]);
    };

    const handleRemovePhase = (index: number) => {
        if (phases.length <= 1) return;
        setPhases(phases.filter((_, i) => i !== index));
    };

    const handlePhaseChange = (
        index: number,
        field: keyof SkillPhase,
        value: string,
    ) => {
        setPhases(
            phases.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        );
        // Clear validation errors for this phase
        const errKey = `phase-${index}-${field}`;
        if (validationErrors[errKey]) {
            setValidationErrors((prev) => {
                const copy = { ...prev };
                delete copy[errKey];
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
        if (triggerHints.length === 0) {
            errs.triggerHints = "Provide at least 1 trigger keyword.";
        }

        phases.forEach((p, i) => {
            if (!p.title || p.title.trim().length < 2) {
                errs[`phase-${i}-title`] = "Title is required.";
            }
            if (!p.rules || p.rules.trim().length < 10) {
                errs[`phase-${i}-rules`] =
                    "Rules must be at least 10 characters.";
            }
        });

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
            const body = {
                name: name.trim(),
                description: description.trim(),
                triggerHints,
                phases: phases.map((p) => ({
                    title: p.title.trim(),
                    rules: p.rules.trim(),
                })),
            };

            const url = isEdit ? `/api/skills/${skill!.id}` : "/api/skills";
            const method = isEdit ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                onSave();
                onOpenChange(false);
            } else {
                const errData = await res.json();
                setError(
                    typeof errData.error === "string"
                        ? errData.error
                        : "Failed to save skill. Check your inputs.",
                );
            }
        } catch (err) {
            logger.error("Failed to save skill:", err);
            setError("A network error occurred. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-background border-border max-h-[85vh] overflow-y-auto shadow-xl sm:max-w-[580px]">
                <DialogHeader>
                    <DialogTitle className="text-foreground flex items-center gap-2">
                        <Sparkles className="text-primary h-5 w-5" />
                        {isEdit
                            ? `Edit Skill: ${skill?.name}`
                            : "Create Custom Pattern Skill"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                        Define a custom generative workflow structure. The AI
                        Director will execute these rules step-by-step when
                        triggered by chat keywords.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 py-2">
                    {/* Display API Errors */}
                    {error && (
                        <div className="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Skill Name */}
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="skill-name"
                            className="text-foreground flex items-center gap-1 text-xs font-semibold"
                        >
                            Skill Identifier (Kebab-case){" "}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="skill-name"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
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
                                Automatically normalized to lowercase
                                kebab-case. Used as a forced command:{" "}
                                <code>/{name || "identifier"}</code>.
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
                        <Textarea
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
                            placeholder="Explain what this skill generates and what it is best used for..."
                            disabled={saving}
                            rows={3}
                            className={`bg-muted/30 border-border text-xs ${
                                validationErrors.description
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                            }`}
                        />
                        {validationErrors.description ? (
                            <p className="text-destructive text-[10px]">
                                {validationErrors.description}
                            </p>
                        ) : (
                            <p className="text-muted-foreground text-[10px]">
                                Used by the AI to match natural language prompts
                                to this skill.
                            </p>
                        )}
                    </div>

                    {/* Trigger Hints (Tags Input) */}
                    <div className="space-y-1.5">
                        <Label className="text-foreground text-xs font-semibold">
                            Trigger Keywords / Hints{" "}
                            <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                value={hintInput}
                                onChange={(e) => setHintInput(e.target.value)}
                                onKeyDown={handleKeyDownHint}
                                placeholder="Add keyword (comma or Enter)..."
                                disabled={saving}
                                className={`bg-muted/30 border-border h-9 flex-1 text-xs ${
                                    validationErrors.triggerHints
                                        ? "border-destructive focus-visible:ring-destructive"
                                        : ""
                                }`}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddHint}
                                disabled={saving}
                                className="border-border bg-muted/20 hover:bg-muted/50 text-foreground h-9 text-xs font-medium"
                            >
                                Add
                            </Button>
                        </div>
                        {/* Render Keywords Badges */}
                        <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
                            {triggerHints.length === 0 ? (
                                <p className="text-muted-foreground mt-0.5 text-[10px] italic">
                                    No keywords added yet.
                                </p>
                            ) : (
                                triggerHints.map((hint) => (
                                    <span
                                        key={hint}
                                        className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px]"
                                    >
                                        {hint}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveHint(hint)
                                            }
                                            disabled={saving}
                                            className="hover:text-destructive text-muted-foreground transition-colors"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </span>
                                ))
                            )}
                        </div>
                        {validationErrors.triggerHints && (
                            <p className="text-destructive text-[10px]">
                                {validationErrors.triggerHints}
                            </p>
                        )}
                    </div>

                    <div className="border-border/40 my-2 border-t" />

                    {/* Phases dynamic list */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                                <Play className="text-primary h-3.5 w-3.5" />{" "}
                                Workflow Phases & Rules
                            </Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleAddPhase}
                                disabled={saving}
                                className="text-primary hover:text-primary hover:bg-primary/10 h-8 gap-1 text-xs"
                            >
                                <Plus className="h-3 w-3" /> Add Phase
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {phases.map((phase, index) => (
                                <div
                                    key={index}
                                    className="border-border bg-muted/10 hover:border-border-hover relative space-y-3 rounded-lg border p-3 transition-colors"
                                >
                                    {/* Header / Remove button */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                                            Phase {index + 1}
                                        </span>
                                        {phases.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleRemovePhase(index)
                                                }
                                                disabled={saving}
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-6 w-6 rounded"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Phase Title */}
                                    <div className="space-y-1">
                                        <Label className="text-foreground text-[10px] font-semibold">
                                            Phase Title
                                        </Label>
                                        <Input
                                            value={phase.title}
                                            onChange={(e) =>
                                                handlePhaseChange(
                                                    index,
                                                    "title",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="e.g. Phase 1: Establish Hero Shot"
                                            disabled={saving}
                                            className={`bg-muted/30 border-border h-8 text-xs ${
                                                validationErrors[
                                                    `phase-${index}-title`
                                                ]
                                                    ? "border-destructive focus-visible:ring-destructive"
                                                    : ""
                                            }`}
                                        />
                                        {validationErrors[
                                            `phase-${index}-title`
                                        ] && (
                                            <p className="text-destructive text-[9px]">
                                                {
                                                    validationErrors[
                                                        `phase-${index}-title`
                                                    ]
                                                }
                                            </p>
                                        )}
                                    </div>

                                    {/* Phase Rules */}
                                    <div className="space-y-1">
                                        <Label className="text-foreground text-[10px] font-semibold">
                                            Rules & Instructions
                                        </Label>
                                        <Textarea
                                            value={phase.rules}
                                            onChange={(e) =>
                                                handlePhaseChange(
                                                    index,
                                                    "rules",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Specify what this phase should generate and any constraints (e.g. 'Use a cinematic style, set the model to Veo 3.1 Pro, and make it look premium.')"
                                            disabled={saving}
                                            rows={3}
                                            className={`bg-muted/30 border-border text-xs ${
                                                validationErrors[
                                                    `phase-${index}-rules`
                                                ]
                                                    ? "border-destructive focus-visible:ring-destructive"
                                                    : ""
                                            }`}
                                        />
                                        {validationErrors[
                                            `phase-${index}-rules`
                                        ] && (
                                            <p className="text-destructive text-[9px]">
                                                {
                                                    validationErrors[
                                                        `phase-${index}-rules`
                                                    ]
                                                }
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <DialogFooter className="border-border/20 border-t pt-2">
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
