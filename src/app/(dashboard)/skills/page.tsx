"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Plus,
    Pencil,
    Trash2,
    Calendar,
    Sparkles,
    Loader2,
    Copy,
    Share2,
    Download,
    Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SkillEditor } from "@/components/canvas/skill-editor";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import type { UserSkillDocument } from "@/lib/canvas/agent/skills/skill-types";
import { useSession } from "next-auth/react";

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function parseSkillMarkdown(content: string): {
    name: string;
    description: string;
    instructions: string;
} {
    const trimContent = content.trim();
    let name = "unnamed-skill";
    let description = "Imported custom skill.";
    let instructions = trimContent;

    // Parse YAML frontmatter if it exists
    if (trimContent.startsWith("---")) {
        const parts = trimContent.split("---");
        if (parts.length >= 3) {
            const yaml = parts[1];
            instructions = parts.slice(2).join("---").trim();

            const yamlLines = yaml.split("\n");
            for (const line of yamlLines) {
                const index = line.indexOf(":");
                if (index !== -1) {
                    const key = line.substring(0, index).trim().toLowerCase();
                    const val = line
                        .substring(index + 1)
                        .trim()
                        .replace(/^["']|["']$/g, ""); // strip quotes
                    if (key === "name") {
                        name = val;
                    } else if (key === "description") {
                        description = val;
                    }
                }
            }
        }
    }

    return { name, description, instructions };
}

interface SkillCardProps {
    skill: UserSkillDocument;
    onEdit: (skill: UserSkillDocument) => void;
    onDelete: (id: string) => void;
    onShare: (skill: UserSkillDocument) => void;
    onExport: (skill: UserSkillDocument) => void;
}

function SkillCard({
    skill,
    onEdit,
    onDelete,
    onShare,
    onExport,
}: SkillCardProps) {
    return (
        <div className="group bg-card hover:border-foreground/20 flex flex-col justify-between overflow-hidden rounded-xl border p-5 transition-all duration-200">
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                            <Sparkles className="text-primary size-4" />
                        </div>
                        <span className="max-w-[160px] truncate text-sm font-semibold tracking-tight">
                            {skill.name}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-md"
                            onClick={() => onShare(skill)}
                            title="Share skill"
                        >
                            <Share2 className="size-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-md"
                            onClick={() => onExport(skill)}
                            title="Export skill"
                        >
                            <Download className="size-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-md"
                            onClick={() => onEdit(skill)}
                            title="Edit skill"
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive size-7 rounded-md"
                            onClick={() => onDelete(skill.id)}
                            title="Delete skill"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </div>
                </div>

                {skill.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                        {skill.description}
                    </p>
                )}
            </div>

            <div className="text-muted-foreground border-border/40 mt-5 flex items-center gap-1 border-t pt-3 text-[10px] font-medium tracking-wide uppercase">
                <Calendar className="size-3" />
                <span>Updated {formatDate(skill.updatedAt)}</span>
            </div>
        </div>
    );
}

function ReadOnlySkillCard({
    skill,
    onClone,
    onExport,
}: {
    skill: UserSkillDocument;
    onClone: (id: string) => void;
    onExport: (skill: UserSkillDocument) => void;
}) {
    return (
        <div className="group bg-card hover:border-foreground/20 flex flex-col justify-between overflow-hidden rounded-xl border p-5 transition-all duration-200">
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                            <Sparkles className="text-primary size-4" />
                        </div>
                        <span className="max-w-[160px] truncate text-sm font-semibold tracking-tight">
                            {skill.name}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-md opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        onClick={() => onExport(skill)}
                        title="Export skill"
                    >
                        <Download className="size-3.5" />
                    </Button>
                </div>

                {skill.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                        {skill.description}
                    </p>
                )}
            </div>

            <div className="border-border/40 mt-5 flex items-center gap-2 border-t pt-3">
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full gap-1 text-xs"
                    onClick={() => onClone(skill.id)}
                >
                    <Copy className="size-3" />
                    Customize
                </Button>
            </div>
        </div>
    );
}

type SkillsTab = "my" | "community";

const TAB_LABELS: Record<SkillsTab, string> = {
    my: "My Skills",
    community: "Templates",
};

export default function SkillsPage() {
    const { data: session } = useSession();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<SkillsTab>("my");
    const [skills, setSkills] = useState<UserSkillDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState<
        Partial<UserSkillDocument> | undefined
    >();
    const [shareTarget, setShareTarget] = useState<UserSkillDocument | null>(
        null,
    );

    const fetchSkills = useCallback(async (tab: SkillsTab) => {
        setLoading(true);
        setSkills([]);
        try {
            const res = await fetch(`/api/skills?tab=${tab}`);
            if (!res.ok) throw new Error("Failed to fetch skills");
            const data = (await res.json()) as { skills: UserSkillDocument[] };
            setSkills(data.skills ?? []);
        } catch {
            toast.error("Failed to load skills");
            setSkills([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setTimeout(() => {
            void fetchSkills(activeTab);
        }, 0);
    }, [fetchSkills, activeTab]);

    const handleNew = useCallback(() => {
        setEditingSkill(undefined);
        setEditorOpen(true);
    }, []);

    const handleEdit = useCallback((skill: UserSkillDocument) => {
        setEditingSkill(skill);
        setEditorOpen(true);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/skills/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete skill");
            setSkills((prev) => prev.filter((s) => s.id !== id));
            toast.success("Skill deleted");
        } catch {
            toast.error("Failed to delete skill");
        }
    }, []);

    const handleClone = useCallback(
        async (id: string) => {
            try {
                const res = await fetch(`/api/skills/${id}/clone`, {
                    method: "POST",
                });
                if (!res.ok) throw new Error("Failed to clone skill");
                toast.success("Skill customized in your library");
                setActiveTab("my");
                void fetchSkills("my");
            } catch {
                toast.error("Failed to customize skill");
            }
        },
        [fetchSkills],
    );

    const handleSave = async (data: {
        name: string;
        description: string;
        instructions: string;
    }) => {
        if (editingSkill?.id) {
            const res = await fetch(`/api/skills/${editingSkill.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to save skill");
            const updated = (await res.json()) as UserSkillDocument;
            setSkills((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s)),
            );
            toast.success("Skill saved");
        } else {
            const res = await fetch("/api/skills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create skill");
            const created = (await res.json()) as UserSkillDocument;
            setSkills((prev) => [created, ...prev]);
            toast.success("Skill created");
        }
    };

    const handleExport = useCallback((skill: UserSkillDocument) => {
        try {
            const fileContent = [
                "---",
                `name: ${skill.name}`,
                `description: ${skill.description}`,
                "---",
                "",
                skill.instructions,
            ].join("\n");

            const blob = new Blob([fileContent], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${skill.name}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(`Exported ${skill.name}.md`);
        } catch {
            toast.error("Failed to export skill");
        }
    }, []);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const parsed = parseSkillMarkdown(content);

                // Use the file name (without extension) if parsed name is default/empty
                if (parsed.name === "unnamed-skill") {
                    const baseName = file.name.replace(/\.[^/.]+$/, "");
                    parsed.name = baseName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-");
                }

                // Save to database
                const res = await fetch("/api/skills", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(parsed),
                });

                if (!res.ok) {
                    const errData = (await res.json()) as { error?: string };
                    throw new Error(
                        errData.error || "Failed to import skill to database",
                    );
                }

                const created = (await res.json()) as UserSkillDocument;
                setSkills((prev) => [created, ...prev]);
                toast.success(`Imported skill: ${created.name}`);
            } catch (err) {
                console.error("Failed to import skill:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to import skill",
                );
            }
        };
        reader.readAsText(file);
        // Reset file input
        e.target.value = "";
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Skills</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Custom workflows and design instructions for the AI
                        Director
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".md,.txt"
                        onChange={handleImportFile}
                        className="hidden"
                    />
                    <Button
                        onClick={handleImportClick}
                        variant="outline"
                        className="h-9 gap-2 text-xs font-medium"
                    >
                        <Upload className="size-4" />
                        Import SKILL.md
                    </Button>
                    {activeTab === "my" && (
                        <Button
                            onClick={handleNew}
                            className="h-9 gap-2 text-xs font-medium"
                        >
                            <Plus className="size-4" />
                            New Skill
                        </Button>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div className="border-border flex gap-1 border-b">
                {(["my", "community"] as SkillsTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 pb-2 text-sm font-medium transition-colors ${
                            activeTab === tab
                                ? "border-primary text-foreground border-b-2"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex h-48 items-center justify-center">
                    <Loader2 className="text-muted-foreground size-6 animate-spin" />
                </div>
            ) : activeTab === "my" ? (
                <>
                    {skills.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {skills.map((skill) => (
                                <SkillCard
                                    key={skill.id}
                                    skill={skill}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onShare={setShareTarget}
                                    onExport={handleExport}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="border-border flex h-48 flex-col items-center justify-center rounded-lg border border-dashed">
                            <p className="text-muted-foreground mb-4 text-sm">
                                No custom skills yet
                            </p>
                            <Button
                                onClick={handleNew}
                                size="sm"
                                className="h-8 text-xs"
                            >
                                <Plus className="mr-2 size-3.5" />
                                Create your first skill
                            </Button>
                        </div>
                    )}
                </>
            ) : skills.length === 0 ? (
                <div className="border-border flex h-48 flex-col items-center justify-center rounded-lg border border-dashed">
                    <p className="text-muted-foreground text-sm">
                        No templates available
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {skills.map((skill) => (
                        <ReadOnlySkillCard
                            key={skill.id}
                            skill={skill}
                            onClone={handleClone}
                            onExport={handleExport}
                        />
                    ))}
                </div>
            )}

            <SkillEditor
                open={editorOpen}
                onOpenChange={setEditorOpen}
                initialSkill={editingSkill}
                onSave={handleSave}
            />

            {shareTarget && (
                <ShareDialog
                    isOpen={!!shareTarget}
                    onClose={() => setShareTarget(null)}
                    artifactType="skill"
                    artifactId={shareTarget.id}
                    artifactName={shareTarget.name}
                    currentVisibility={shareTarget.visibility}
                    sharedWith={shareTarget.sharedWith}
                    isTemplate={shareTarget.isTemplate}
                    isOwner={shareTarget.userId === session?.user?.id}
                    isAdmin={false}
                    onSaved={() => fetchSkills(activeTab)}
                />
            )}
        </div>
    );
}
