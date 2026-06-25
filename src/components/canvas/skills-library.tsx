"use client";

import { useEffect, useState, useMemo } from "react";
import {
    Search,
    Plus,
    Trash2,
    Edit3,
    Copy,
    Loader2,
    AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { SkillEditor } from "./skill-editor";
import type {
    UserSkillDocument,
    SkillPhase,
} from "@/lib/canvas/agent/skills/skill-types";
import logger from "@/app/logger";

interface ExtendedSkill {
    id: string;
    name: string;
    description: string;
    triggerHints: string[];
    isBuiltIn?: boolean;
    isTemplate?: boolean;
    userId?: string;
    phases?: SkillPhase[];
}

// Define the hardcoded built-in skills
const BUILT_IN_SKILLS = [
    {
        id: "character-generation",
        name: "character-generation",
        description:
            "Design and maintain consistent character references across multiple shots.",
        triggerHints: [
            "character reference",
            "consistent character",
            "character sheet",
            "avatar",
        ],
        isBuiltIn: true,
    },
    {
        id: "multi-shot-video",
        name: "multi-shot-video",
        description:
            "Plan and generate multi-scene cinematic videos with precise continuity.",
        triggerHints: [
            "movie trailer",
            "cinematic video",
            "multi-shot video",
            "scene continuity",
        ],
        isBuiltIn: true,
    },
    {
        id: "storyboard",
        name: "storyboard",
        description:
            "Sequence visual narratives, setting up frames, camera angles, and action cues.",
        triggerHints: [
            "storyboard",
            "shot list",
            "scene sequence",
            "comic strip",
        ],
        isBuiltIn: true,
    },
    {
        id: "virtual-tryon",
        name: "virtual-tryon",
        description:
            "Seamlessly map clothing, accessories, or styles onto a reference person node.",
        triggerHints: [
            "virtual tryon",
            "try on clothing",
            "swap outfit",
            "fashion model",
        ],
        isBuiltIn: true,
    },
];

export function SkillsLibrary() {
    const canvasId = useCanvasStore((s) => s.canvasId);
    const disabledSkills = useCanvasStore((s) => s.disabledSkills);
    const toggleDisabledSkill = useCanvasStore((s) => s.toggleDisabledSkill);

    const [activeTab, setActiveTab] = useState<"my" | "built-in" | "community">(
        "my",
    );
    const [searchQuery, setSearchQuery] = useState("");

    // Skill state
    const [mySkills, setMySkills] = useState<UserSkillDocument[]>([]);
    const [communitySkills, setCommunitySkills] = useState<UserSkillDocument[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Editor modal state
    const [editingSkill, setEditingSkill] = useState<UserSkillDocument | null>(
        null,
    );
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Load skills
    const loadSkills = async () => {
        setLoading(true);
        try {
            const [myRes, commRes] = await Promise.all([
                fetch("/api/skills?tab=my"),
                fetch("/api/skills?tab=community"),
            ]);

            if (myRes.ok) {
                const data = await myRes.json();
                setMySkills(data.skills ?? []);
            }
            if (commRes.ok) {
                const data = await commRes.json();
                setCommunitySkills(data.skills ?? []);
            }
        } catch (err) {
            logger.error("Failed to load skills:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setTimeout(() => {
            void loadSkills();
        }, 0);
    }, []);

    // Toggle disabled state in store and Firestore
    const handleToggle = async (skillName: string, isEnabled: boolean) => {
        // Optimistic update
        toggleDisabledSkill(skillName);

        try {
            const res = await fetch(`/api/canvases/${canvasId}/toggle-skill`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skillName, enabled: isEnabled }),
            });

            if (!res.ok) {
                // Revert on error
                toggleDisabledSkill(skillName);
                logger.error("Failed to toggle skill on backend");
            }
        } catch (err) {
            // Revert on error
            toggleDisabledSkill(skillName);
            logger.error("Failed to toggle skill:", err);
        }
    };

    // Clone/fork skill
    const handleClone = async (skillId: string, name: string) => {
        setActionLoading(skillId);
        try {
            const res = await fetch(`/api/skills/${skillId}/clone`, {
                method: "POST",
            });
            if (res.ok) {
                await loadSkills();
                setActiveTab("my");
            } else {
                logger.error(`Failed to clone skill ${name}`);
            }
        } catch (err) {
            logger.error(`Error cloning skill ${name}:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    // Clone a built-in skill by creating a custom copy
    const handleCloneBuiltIn = async (builtIn: (typeof BUILT_IN_SKILLS)[0]) => {
        setActionLoading(builtIn.id);
        try {
            const res = await fetch("/api/skills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `my-${builtIn.name}`,
                    description: `Customized copy of built-in ${builtIn.name} skill. ${builtIn.description}`,
                    triggerHints: [
                        ...builtIn.triggerHints,
                        `custom-${builtIn.name}`,
                    ],
                    phases: [
                        {
                            title: "Phase 1",
                            rules: "Enter customized instructions here.",
                        },
                    ],
                }),
            });

            if (res.ok) {
                await loadSkills();
                setActiveTab("my");
            } else {
                logger.error(`Failed to clone built-in ${builtIn.name}`);
            }
        } catch (err) {
            logger.error(`Error cloning built-in ${builtIn.name}:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    // Delete skill
    const handleDelete = async (skillId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the skill "${name}"?`))
            return;
        setActionLoading(skillId);
        try {
            const res = await fetch(`/api/skills/${skillId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setMySkills((prev) => prev.filter((s) => s.id !== skillId));
            } else {
                logger.error(`Failed to delete skill ${name}`);
            }
        } catch (err) {
            logger.error(`Error deleting skill ${name}:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCreateNew = () => {
        setEditingSkill(null);
        setIsEditorOpen(true);
    };

    const handleEdit = (skill: UserSkillDocument) => {
        setEditingSkill(skill);
        setIsEditorOpen(true);
    };

    // Filter skills by search query
    const filteredSkills = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        let list: ExtendedSkill[] = [];

        if (activeTab === "my") list = mySkills;
        else if (activeTab === "built-in") list = BUILT_IN_SKILLS;
        else if (activeTab === "community") list = communitySkills;

        if (!query) return list;

        return list.filter(
            (s) =>
                s.name.toLowerCase().includes(query) ||
                s.description.toLowerCase().includes(query) ||
                s.triggerHints.some((h: string) =>
                    h.toLowerCase().includes(query),
                ),
        );
    }, [activeTab, mySkills, communitySkills, searchQuery]);

    return (
        <div className="flex h-full flex-col p-4">
            {/* Toolbar / Search */}
            <div className="mb-4 flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                    <Input
                        placeholder="Search skills..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-muted/50 border-border h-9 pl-8 text-xs focus-visible:ring-1"
                    />
                </div>
                <Button
                    size="sm"
                    onClick={handleCreateNew}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 gap-1.5 px-3 text-xs font-medium shadow-sm"
                >
                    <Plus className="h-3.5 w-3.5" /> New
                </Button>
            </div>

            {/* Tab selector */}
            <div className="bg-muted/40 border-border mb-4 grid grid-cols-3 rounded-lg border p-1">
                <button
                    onClick={() => setActiveTab("my")}
                    className={`rounded-md py-1.5 text-xs font-medium transition-all ${
                        activeTab === "my"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    My Skills
                </button>
                <button
                    onClick={() => setActiveTab("built-in")}
                    className={`rounded-md py-1.5 text-xs font-medium transition-all ${
                        activeTab === "built-in"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Built-in
                </button>
                <button
                    onClick={() => setActiveTab("community")}
                    className={`rounded-md py-1.5 text-xs font-medium transition-all ${
                        activeTab === "community"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Templates
                </button>
            </div>

            {/* Skills List */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                    </div>
                ) : filteredSkills.length === 0 ? (
                    <div className="border-border bg-muted/20 flex h-40 flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center">
                        <AlertCircle className="text-muted-foreground mb-2 h-6 w-6" />
                        <p className="text-muted-foreground text-xs">
                            No skills found.
                        </p>
                        {activeTab === "my" && (
                            <Button
                                variant="link"
                                size="sm"
                                onClick={handleCreateNew}
                                className="text-primary mt-1 text-xs"
                            >
                                Create your first skill
                            </Button>
                        )}
                    </div>
                ) : (
                    filteredSkills.map((skill) => {
                        const isEnabled = !disabledSkills.includes(skill.name);
                        const isLoading = actionLoading === skill.id;

                        return (
                            <Card
                                key={skill.id}
                                className="bg-card/40 border-border/60 hover:border-border shadow-sm transition-all"
                            >
                                <CardHeader className="p-3 pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <CardTitle className="text-foreground flex items-center gap-1.5 truncate text-sm font-semibold">
                                                {skill.name}
                                                {skill.isBuiltIn && (
                                                    <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase">
                                                        Built-in
                                                    </span>
                                                )}
                                                {skill.isTemplate &&
                                                    !skill.isBuiltIn && (
                                                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-500 uppercase">
                                                            Template
                                                        </span>
                                                    )}
                                            </CardTitle>
                                            <CardDescription className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-relaxed">
                                                {skill.description}
                                            </CardDescription>
                                        </div>
                                        <div className="flex shrink-0 items-center space-x-2">
                                            <Switch
                                                checked={isEnabled}
                                                onCheckedChange={(checked) =>
                                                    handleToggle(
                                                        skill.name,
                                                        checked,
                                                    )
                                                }
                                                aria-label={`Toggle ${skill.name}`}
                                                className="scale-90"
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 pb-2">
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {skill.triggerHints.map(
                                            (hint: string) => (
                                                <span
                                                    key={hint}
                                                    className="bg-muted/60 text-muted-foreground border-border/40 rounded border px-2 py-0.5 font-mono text-[10px]"
                                                >
                                                    {hint}
                                                </span>
                                            ),
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="border-border/20 flex justify-end gap-1.5 border-t p-3 pt-1">
                                    {skill.isBuiltIn ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                handleCloneBuiltIn(
                                                    skill as (typeof BUILT_IN_SKILLS)[0],
                                                )
                                            }
                                            disabled={isLoading}
                                            className="text-muted-foreground hover:text-foreground hover:bg-accent/50 h-7 gap-1 px-2 text-[11px]"
                                            title="Clone to customize"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                            Customize
                                        </Button>
                                    ) : activeTab === "my" ? (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleEdit(
                                                        skill as UserSkillDocument,
                                                    )
                                                }
                                                disabled={isLoading}
                                                className="text-muted-foreground hover:text-foreground hover:bg-accent/50 h-7 gap-1 px-2 text-[11px]"
                                            >
                                                <Edit3 className="h-3 w-3" />{" "}
                                                Edit
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleClone(
                                                        skill.id,
                                                        skill.name,
                                                    )
                                                }
                                                disabled={isLoading}
                                                className="text-muted-foreground hover:text-foreground hover:bg-accent/50 h-7 gap-1 px-2 text-[11px]"
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}{" "}
                                                Clone
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleDelete(
                                                        skill.id,
                                                        skill.name,
                                                    )
                                                }
                                                disabled={isLoading}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 gap-1 px-2 text-[11px]"
                                            >
                                                <Trash2 className="h-3 w-3" />{" "}
                                                Delete
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                handleClone(
                                                    skill.id,
                                                    skill.name,
                                                )
                                            }
                                            disabled={isLoading}
                                            className="text-muted-foreground hover:text-foreground hover:bg-accent/50 h-7 gap-1 px-2 text-[11px]"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}{" "}
                                            Add to My Skills
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Skill Editor Modal */}
            <SkillEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                skill={editingSkill}
                onSave={loadSkills}
            />
        </div>
    );
}
