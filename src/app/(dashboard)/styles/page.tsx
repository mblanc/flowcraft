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
    ImageIcon,
    Share2,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StyleEditorDialog } from "@/components/flow/style-editor-dialog";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import type { StyleDocument } from "@/lib/styles/style-types";
import type { TemplateStyle } from "@/lib/styles/style-templates";
import { STYLE_TEMPLATES } from "@/lib/styles/style-templates";
import { useSession } from "next-auth/react";

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
    onShare: (style: StyleDocument) => void;
}

function StyleCard({ style, onEdit, onDelete, onShare }: StyleCardProps) {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);

    useEffect(() => {
        if (style.referenceImageUris.length === 0) return;
        const uri = style.referenceImageUris[0];
        let cancelled = false;
        fetch(`/api/signed-url?gcsUri=${encodeURIComponent(uri)}`)
            .then(async (res) => {
                if (res.ok && !cancelled) {
                    const { signedUrl } = (await res.json()) as {
                        signedUrl: string;
                    };
                    setSignedUrl(signedUrl);
                }
            })
            .catch((error) => {
                console.error("Failed to fetch signed URL:", error);
            });
        return () => {
            cancelled = true;
        };
    }, [style.referenceImageUris]);

    return (
        <div className="group bg-card hover:border-foreground/20 flex flex-col overflow-hidden rounded-xl border transition-colors">
            <div className="bg-muted relative aspect-video w-full overflow-hidden border-b">
                {signedUrl ? (
                    <Image
                        src={signedUrl}
                        alt={style.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 opacity-40">
                        <Palette className="size-8" />
                        <span className="text-[10px] font-medium tracking-wider uppercase">
                            No Reference Images
                        </span>
                    </div>
                )}
                <div className="bg-background/80 absolute top-2 right-2 flex items-center gap-1 rounded-md p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => onShare(style)}
                        title="Share style"
                    >
                        <Share2 className="size-3.5" />
                    </Button>
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

            <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                            {style.name}
                        </span>
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
                        <span className="ml-auto flex items-center gap-1">
                            <ImageIcon className="size-3" />
                            {style.referenceImageUris.length}
                        </span>
                    )}
                </div>
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
        <div className="group bg-card/50 hover:border-foreground/20 hover:bg-card flex flex-col overflow-hidden rounded-xl border border-dashed transition-colors">
            <div className="bg-muted/50 relative aspect-video w-full overflow-hidden border-b border-dashed">
                <div className="flex size-full flex-col items-center justify-center gap-2 opacity-30">
                    <Palette className="size-8" />
                    <span className="text-[10px] font-medium tracking-wider uppercase">
                        Template Preview
                    </span>
                </div>
                <div className="bg-background/80 absolute top-2 right-2 flex items-center gap-1 rounded-md p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => onUse(template)}
                        title="Use template"
                    >
                        <Copy className="size-3.5" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                            {template.name}
                        </span>
                    </div>
                </div>

                {template.description && (
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                        {template.description}
                    </p>
                )}

                <div className="mt-auto pt-1">
                    <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                        Template
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function StylesPage() {
    const { data: session } = useSession();
    const [styles, setStyles] = useState<StyleDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingStyle, setEditingStyle] = useState<
        Partial<StyleDocument> | undefined
    >();
    const [shareTarget, setShareTarget] = useState<StyleDocument | null>(null);

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
                                        onShare={setShareTarget}
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

            {shareTarget && (
                <ShareDialog
                    isOpen={!!shareTarget}
                    onClose={() => setShareTarget(null)}
                    artifactType="style"
                    artifactId={shareTarget.id}
                    artifactName={shareTarget.name}
                    currentVisibility={shareTarget.visibility}
                    sharedWith={shareTarget.sharedWith}
                    isTemplate={shareTarget.isTemplate}
                    isOwner={shareTarget.userId === session?.user?.id}
                    isAdmin={false}
                    onSaved={fetchStyles}
                />
            )}
        </div>
    );
}
