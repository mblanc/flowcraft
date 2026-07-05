"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Copy, Loader2, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import type { UserSkillDocument } from "@/lib/canvas/agent/skills/skill-types";
import logger from "@/app/logger";
import { toast } from "sonner";

interface ExtendedSkill {
    id: string;
    name: string;
    description: string;
    isBuiltIn?: boolean;
    isTemplate?: boolean;
    userId?: string;
    instructions?: string;
}

// Define the hardcoded built-in skills
const BUILT_IN_SKILLS = [
    {
        id: "character-generation",
        name: "character-generation",
        description:
            "Design and maintain consistent character references across multiple shots.",
        isBuiltIn: true,
    },
    {
        id: "multi-shot-video",
        name: "multi-shot-video",
        description:
            "Plan and generate multi-scene cinematic videos with precise continuity (ONLY use for videos longer than 10s).",
        isBuiltIn: true,
    },
    {
        id: "storyboard",
        name: "storyboard",
        description:
            "Sequence visual narratives, setting up frames, camera angles, and action cues.",
        isBuiltIn: true,
    },
    {
        id: "virtual-tryon",
        name: "virtual-tryon",
        description:
            "Seamlessly map clothing, accessories, or styles onto a reference person node.",
        isBuiltIn: true,
    },
];

export function SkillsLibrary() {
    const canvasId = useCanvasStore((s) => s.canvasId);
    const disabledSkills = useCanvasStore((s) => s.disabledSkills);
    const toggleDisabledSkill = useCanvasStore((s) => s.toggleDisabledSkill);

    const [activeTab, setActiveTab] = useState<"my" | "shared" | "community">(
        "my",
    );
    const [searchQuery, setSearchQuery] = useState("");

    // Skill state
    const [mySkills, setMySkills] = useState<UserSkillDocument[]>([]);
    const [sharedSkills, setSharedSkills] = useState<UserSkillDocument[]>([]);
    const [communitySkills, setCommunitySkills] = useState<UserSkillDocument[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Load skills
    const loadSkills = async () => {
        setLoading(true);
        try {
            const [myRes, sharedRes, commRes] = await Promise.all([
                fetch("/api/skills?tab=my"),
                fetch("/api/skills?tab=shared"),
                fetch("/api/skills?tab=community"),
            ]);

            if (myRes.ok) {
                const data = await myRes.json();
                setMySkills(data.skills ?? []);
            }
            if (sharedRes.ok) {
                const data = await sharedRes.json();
                setSharedSkills(data.skills ?? []);
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
                toast.error("Failed to update skill toggle state");
            }
        } catch (err) {
            // Revert on error
            toggleDisabledSkill(skillName);
            logger.error("Failed to toggle skill:", err);
            toast.error("Network error toggling skill");
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
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span>Skill customized successfully!</span>
                        <Link
                            href="/skills"
                            className="text-primary flex items-center gap-1 text-xs font-semibold hover:underline"
                        >
                            Go to Skills Dashboard to edit{" "}
                            <ExternalLink className="size-3" />
                        </Link>
                    </div>,
                );
            } else {
                toast.error(`Failed to clone skill ${name}`);
            }
        } catch (err) {
            logger.error(`Error cloning skill ${name}:`, err);
            toast.error("Failed to clone skill");
        } finally {
            setActionLoading(null);
        }
    };

    // Clone a built-in skill by creating a custom copy
    const handleCloneBuiltIn = async (builtIn: (typeof BUILT_IN_SKILLS)[0]) => {
        setActionLoading(builtIn.id);
        try {
            // Check if user already has a skill with the same base name to avoid conflict
            const baseName = `my-${builtIn.name}`;
            const exists = mySkills.some((s) => s.name === baseName);
            if (exists) {
                toast.error(`You have already customized ${builtIn.name}!`);
                return;
            }

            const res = await fetch("/api/skills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: baseName,
                    description: `Customized version of the built-in ${builtIn.name} skill.`,
                    instructions: `# ${builtIn.name} Instructions\n\nCustomized rules for this workflow.`,
                }),
            });

            if (res.ok) {
                await loadSkills();
                setActiveTab("my");
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span>Customized built-in skill!</span>
                        <Link
                            href="/skills"
                            className="text-primary flex items-center gap-1 text-xs font-semibold hover:underline"
                        >
                            Go to Skills Dashboard to edit{" "}
                            <ExternalLink className="size-3" />
                        </Link>
                    </div>,
                );
            } else {
                const errData = await res.json();
                toast.error(
                    errData.error || `Failed to customize ${builtIn.name}`,
                );
            }
        } catch (err) {
            logger.error(`Error customizing built-in ${builtIn.name}:`, err);
            toast.error("Failed to customize built-in skill");
        } finally {
            setActionLoading(null);
        }
    };

    // Filter skills by search query
    const filteredSkills = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        let list: ExtendedSkill[] = [];

        if (activeTab === "my") {
            list = mySkills;
        } else if (activeTab === "shared") {
            list = sharedSkills;
        } else if (activeTab === "community") {
            list = [...BUILT_IN_SKILLS, ...communitySkills];
        }

        if (!query) return list;

        return list.filter(
            (skill) =>
                skill.name.toLowerCase().includes(query) ||
                skill.description.toLowerCase().includes(query),
        );
    }, [mySkills, sharedSkills, communitySkills, activeTab, searchQuery]);

    return (
        <div className="flex h-full min-h-0 flex-col gap-3.5 p-4">
            {/* Search and Tabs */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search skills..."
                        className="bg-muted/30 border-border/60 placeholder:text-muted-foreground h-9 pl-9 text-xs"
                    />
                </div>

                {/* Segment tabs */}
                <div className="bg-muted/40 border-border/40 flex rounded-lg border p-0.5">
                    {(["my", "shared", "community"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 rounded-[6px] py-1 text-center text-[10px] font-semibold tracking-wide uppercase transition-all duration-150 ${
                                activeTab === tab
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab === "my"
                                ? "My Skills"
                                : tab === "shared"
                                  ? "Shared with Me"
                                  : "Community"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto pr-0.5">
                {loading ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader2 className="text-muted-foreground size-5 animate-spin" />
                    </div>
                ) : filteredSkills.length === 0 ? (
                    <div className="flex h-24 flex-col items-center justify-center text-center">
                        <p className="text-muted-foreground text-xs">
                            No skills found.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {filteredSkills.map((skill) => {
                            const isEnabled = !disabledSkills.includes(
                                skill.name,
                            );
                            const isLoading = actionLoading === skill.id;

                            return (
                                <div
                                    key={skill.id}
                                    className="border-border/40 bg-muted/10 hover:bg-muted/25 flex flex-col gap-1.5 rounded-lg border p-3 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <Sparkles className="text-primary size-3.5 shrink-0" />
                                            <span className="text-foreground truncate text-xs font-semibold">
                                                {skill.name}
                                            </span>
                                            {skill.isBuiltIn && (
                                                <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase">
                                                    Built-in
                                                </span>
                                            )}
                                            {skill.isTemplate &&
                                                !skill.isBuiltIn && (
                                                    <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-emerald-500 uppercase">
                                                        Template
                                                    </span>
                                                )}
                                        </div>
                                        <Switch
                                            checked={isEnabled}
                                            onCheckedChange={(checked) =>
                                                handleToggle(
                                                    skill.name,
                                                    checked,
                                                )
                                            }
                                            aria-label={`Toggle ${skill.name}`}
                                            className="shrink-0 scale-75"
                                        />
                                    </div>

                                    {skill.description && (
                                        <p className="text-muted-foreground line-clamp-2 text-[10px] leading-relaxed">
                                            {skill.description}
                                        </p>
                                    )}

                                    {/* Action Row */}
                                    <div className="mt-0.5 flex items-center justify-between gap-2">
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
                                                className="text-primary hover:text-primary hover:bg-primary/10 h-5 gap-1 px-1.5 text-[9px] font-semibold"
                                                title="Clone to customize"
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                ) : (
                                                    <Copy className="h-2.5 w-2.5" />
                                                )}
                                                Customize
                                            </Button>
                                        ) : activeTab === "my" ? (
                                            <Link
                                                href="/skills"
                                                className="text-primary hover:bg-primary/10 flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-semibold transition-colors"
                                                title="Manage skill in dashboard"
                                            >
                                                Manage{" "}
                                                <ExternalLink className="size-2.5" />
                                            </Link>
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
                                                className="text-primary hover:text-primary hover:bg-primary/10 h-5 gap-1 px-1.5 text-[9px] font-semibold"
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                ) : (
                                                    <Copy className="h-2.5 w-2.5" />
                                                )}
                                                Customize
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer / Redirect Link */}
            <div className="border-border/40 mt-1 shrink-0 border-t pt-3">
                <Link
                    href="/skills"
                    className="bg-primary/10 hover:bg-primary/20 text-primary flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all"
                >
                    Open Skills Dashboard <ExternalLink className="size-3.5" />
                </Link>
            </div>
        </div>
    );
}
