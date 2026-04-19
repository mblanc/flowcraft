"use client";

import { useState, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X, Wand2, ImageIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import type { StyleDocument } from "@/lib/style-types";

interface StyleEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialStyle?: Partial<StyleDocument>;
    onSave: (data: {
        name: string;
        description: string;
        content: string;
        referenceImageUris: string[];
    }) => Promise<void>;
}

export function StyleEditorDialog({
    open,
    onOpenChange,
    initialStyle,
    onSave,
}: StyleEditorDialogProps) {
    const [name, setName] = useState(initialStyle?.name ?? "");
    const [description, setDescription] = useState(
        initialStyle?.description ?? "",
    );
    const [content, setContent] = useState(initialStyle?.content ?? "");
    const [referenceImageUris, setReferenceImageUris] = useState<string[]>(
        initialStyle?.referenceImageUris ?? [],
    );
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
    const [uploadingImages, setUploadingImages] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mdFileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = useCallback(async (files: FileList) => {
        setUploadingImages(true);
        try {
            const newUris: string[] = [];
            const newSigned: Record<string, string> = {};

            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/upload-file", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) throw new Error("Upload failed");
                const data = (await res.json()) as {
                    gcsUri: string;
                    signedUrl: string;
                };
                newUris.push(data.gcsUri);
                newSigned[data.gcsUri] = data.signedUrl;
            }

            setReferenceImageUris((prev) => [...prev, ...newUris]);
            setSignedUrls((prev) => ({ ...prev, ...newSigned }));
        } catch {
            toast.error("Failed to upload images");
        } finally {
            setUploadingImages(false);
        }
    }, []);

    const handleMarkdownUpload = useCallback(async (file: File) => {
        if (file.size > 500 * 1024) {
            toast.error("File too large (max 500 KB)");
            return;
        }
        const text = await file.text();
        setContent(text);
    }, []);

    const removeImage = useCallback((uri: string) => {
        setReferenceImageUris((prev) => prev.filter((u) => u !== uri));
    }, []);

    const handleGenerate = useCallback(async () => {
        if (!referenceImageUris.length) return;
        setGenerating(true);
        try {
            const res = await fetch(`/api/styles/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ referenceImageUris }),
            });

            if (!res.ok) throw new Error("Generation failed");
            const data = (await res.json()) as {
                name: string;
                description: string;
                content: string;
            };

            if (!name) setName(data.name);
            if (!description) setDescription(data.description);
            setContent(data.content);
            toast.success("Style generated from images");
        } catch {
            toast.error("Failed to generate style");
        } finally {
            setGenerating(false);
        }
    }, [referenceImageUris, name, description]);

    const handleSave = useCallback(async () => {
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }
        setSaving(true);
        try {
            await onSave({ name, description, content, referenceImageUris });
            onOpenChange(false);
        } catch {
            toast.error("Failed to save style");
        } finally {
            setSaving(false);
        }
    }, [name, description, content, referenceImageUris, onSave, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {initialStyle?.id ? "Edit Style" : "New Style"}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-5 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="style-name">Name</Label>
                        <Input
                            id="style-name"
                            placeholder="e.g. Cinematic Noir"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="style-description">Description</Label>
                        <Input
                            id="style-description"
                            placeholder="A short tagline for this style"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="style-content">Content</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={() => mdFileInputRef.current?.click()}
                            >
                                <Upload className="size-3.5" />
                                Upload .md file
                            </Button>
                            <input
                                ref={mdFileInputRef}
                                type="file"
                                accept=".md,text/markdown,text/plain"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleMarkdownUpload(file);
                                    e.target.value = "";
                                }}
                            />
                        </div>
                        <Textarea
                            id="style-content"
                            placeholder="Write your STYLE.md content here, or upload a file / generate from images..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[200px] resize-y font-mono text-sm"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <Label>Reference Images</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                    disabled={uploadingImages}
                                >
                                    {uploadingImages ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <ImageIcon className="size-3.5" />
                                    )}
                                    Add Images
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={handleGenerate}
                                    disabled={
                                        generating || !referenceImageUris.length
                                    }
                                >
                                    {generating ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <Wand2 className="size-3.5" />
                                    )}
                                    Generate Style
                                </Button>
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.length) {
                                    handleImageUpload(e.target.files);
                                }
                                e.target.value = "";
                            }}
                        />

                        {referenceImageUris.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {referenceImageUris.map((uri) => (
                                    <div
                                        key={uri}
                                        className="group bg-muted relative size-20 overflow-hidden rounded-lg border"
                                    >
                                        {signedUrls[uri] ? (
                                            <Image
                                                src={signedUrls[uri]}
                                                alt="Reference"
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="flex size-full items-center justify-center">
                                                <ImageIcon className="text-muted-foreground size-6" />
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeImage(uri)}
                                            className="bg-background/80 absolute top-1 right-1 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {referenceImageUris.length === 0 && (
                            <p className="text-muted-foreground text-xs">
                                Upload reference images and click &quot;Generate
                                Style&quot; to auto-create your style manifest.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                    >
                        {saving && (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                        )}
                        Save Style
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
