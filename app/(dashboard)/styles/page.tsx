"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Plus,
    Pencil,
    Trash2,
    Calendar,
    Palette,
    Loader2,
    Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StyleEditorDialog } from "@/components/styles/style-editor-dialog";
import type { StyleDocument } from "@/lib/style-types";
import type { TemplateStyle } from "@/lib/style-templates";
import { STYLE_TEMPLATES } from "@/lib/style-templates";

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

interface StyleCardProps {
    style: StyleDocument;
    onEdit: (style: StyleDocument) => void;
    onDelete: (id: string) => void;
}

function StyleCard({ style, onEdit, onDelete }: StyleCardProps) {
    return (
        <div className="group bg-card hover:border-foreground/20 flex flex-col gap-3 rounded-xl border p-4 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <Palette className="text-muted-foreground size-4 shrink-0" />
                    <span className="truncate font-medium">{style.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => onEdit(style)}
                    >
                        <Pencil className="size-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive size-7"
                        onClick={() => onDelete(style.id)}
                    >
                        <Trash2 className="size-3.5" />
                    </Button>
                </div>
            </div>

            {style.description && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                    {style.description}
                </p>
            )}

            <div className="text-muted-foreground mt-auto flex items-center gap-1 pt-1 text-xs">
                <Calendar className="size-3" />
                <span>{formatDate(style.updatedAt)}</span>
                {style.referenceImageUris.length > 0 && (
                    <span className="ml-auto">
                        {style.referenceImageUris.length} ref
                        {style.referenceImageUris.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>
        </div>
    );
}

interface TemplateCardProps {
    template: TemplateStyle;
    onUse: (template: TemplateStyle) => void;
}

function TemplateCard({ template, onUse }: TemplateCardProps) {
    return (
        <div className="group bg-card/50 hover:border-foreground/20 hover:bg-card flex flex-col gap-3 rounded-xl border border-dashed p-4 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <Palette className="text-muted-foreground size-4 shrink-0" />
                    <span className="truncate font-medium">
                        {template.name}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onUse(template)}
                    title="Use template"
                >
                    <Copy className="size-3.5" />
                </Button>
            </div>

            {template.description && (
                <p className="text-muted-foreground line-clamp-2 text-sm">
                    {template.description}
                </p>
            )}

            <div className="mt-auto pt-1">
                <span className="text-muted-foreground/60 text-xs font-medium tracking-wide uppercase">
                    Template
                </span>
            </div>
        </div>
    );
}

export default function StylesPage() {
    const [styles, setStyles] = useState<StyleDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingStyle, setEditingStyle] = useState<
        Partial<StyleDocument> | undefined
    >();

    const fetchStyles = useCallback(async () => {
        try {
            const res = await fetch("/api/styles");
            if (!res.ok) throw new Error("Failed to fetch styles");
            const data = (await res.json()) as { styles: StyleDocument[] };
            setStyles(data.styles ?? []);
        } catch {
            toast.error("Failed to load styles");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchStyles();
    }, [fetchStyles]);

    const handleNew = useCallback(() => {
        setEditingStyle(undefined);
        setEditorOpen(true);
    }, []);

    const handleEdit = useCallback((style: StyleDocument) => {
        setEditingStyle(style);
        setEditorOpen(true);
    }, []);

    const handleUseTemplate = useCallback((template: TemplateStyle) => {
        setEditingStyle({
            name: template.name,
            description: template.description,
            content: template.content,
            referenceImageUris: [],
        });
        setEditorOpen(true);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/styles/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete style");
            setStyles((prev) => prev.filter((s) => s.id !== id));
            toast.success("Style deleted");
        } catch {
            toast.error("Failed to delete style");
        }
    }, []);

    const handleSave = async (data: {
        name: string;
        description: string;
        content: string;
        referenceImageUris: string[];
    }) => {
        if (editingStyle?.id) {
            const res = await fetch(`/api/styles/${editingStyle.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to save style");
            const updated = (await res.json()) as StyleDocument;
            setStyles((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s)),
            );
            toast.success("Style saved");
        } else {
            const res = await fetch("/api/styles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create style");
            const created = (await res.json()) as StyleDocument;
            setStyles((prev) => [created, ...prev]);
            toast.success("Style created");
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Styles</h1>
                    <p className="text-muted-foreground mt-1">
                        Visual identity manifests for consistent AI image
                        generation
                    </p>
                </div>
                <Button onClick={handleNew} className="gap-2">
                    <Plus className="size-4" />
                    New Style
                </Button>
            </div>

            {loading ? (
                <div className="flex h-48 items-center justify-center">
                    <Loader2 className="text-muted-foreground size-6 animate-spin" />
                </div>
            ) : (
                <>
                    {styles.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                                My Styles
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {styles.map((style) => (
                                    <StyleCard
                                        key={style.id}
                                        style={style}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="flex flex-col gap-4">
                        <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                            Templates
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {STYLE_TEMPLATES.map((template) => (
                                <TemplateCard
                                    key={template.id}
                                    template={template}
                                    onUse={handleUseTemplate}
                                />
                            ))}
                        </div>
                    </section>
                </>
            )}

            <StyleEditorDialog
                open={editorOpen}
                onOpenChange={setEditorOpen}
                initialStyle={editingStyle}
                onSave={handleSave}
            />
        </div>
    );
}
