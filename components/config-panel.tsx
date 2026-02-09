"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import {
    type LLMData,
    type TextData,
    type ImageData,
    type VideoData,
    type FileData,
    type CustomWorkflowData,
} from "@/lib/types";
import { MODELS } from "@/lib/constants";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "./ui/collapsible";
import { Plus, Trash2, Code, ChevronDown, List } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import logger from "@/app/logger";

function SchemaEditor({
    visualSchema,
    onChange,
}: {
    visualSchema: LLMData["visualSchema"];
    onChange: (schema: LLMData["visualSchema"]) => void;
}) {
    const fields = visualSchema || [];

    const addField = () => {
        onChange([
            ...fields,
            { name: "new_field", type: "string", required: true },
        ]);
    };

    const addListShortcut = () => {
        onChange([...fields, { name: "items", type: "array", required: true }]);
    };

    const updateField = (
        index: number,
        updates: Partial<NonNullable<LLMData["visualSchema"]>[number]>,
    ) => {
        if (!fields) return;
        const newFields = [...fields];
        const currentField = newFields[index];
        if (currentField) {
            newFields[index] = { ...currentField, ...updates };
            onChange(newFields);
        }
    };

    const removeField = (index: number) => {
        onChange(fields.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Response Fields</Label>
                <div className="flex items-center gap-1">
                    <Button
                        onClick={addListShortcut}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        title="Add List of Strings shortcut"
                    >
                        <List className="mr-1 h-3 w-3" />
                        Add List
                    </Button>
                    <Button
                        onClick={addField}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                    >
                        <Plus className="mr-1 h-3 w-3" />
                        Add Field
                    </Button>
                </div>
            </div>

            {fields.length > 0 ? (
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div
                            key={index}
                            className="bg-muted/30 border-border relative space-y-2 rounded-md border p-3 pt-4"
                        >
                            <Button
                                onClick={() => removeField(index)}
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive absolute top-1 right-1 h-6 w-6 p-0"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Name</Label>
                                    <Input
                                        value={field.name}
                                        onChange={(e) =>
                                            updateField(index, {
                                                name: e.target.value.replace(
                                                    /\s+/g,
                                                    "_",
                                                ),
                                            })
                                        }
                                        className="h-7 text-xs"
                                        placeholder="field_name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Type</Label>
                                    <Select
                                        value={field.type}
                                        onValueChange={(value) =>
                                            updateField(index, {
                                                type: value as NonNullable<
                                                    LLMData["visualSchema"]
                                                >[number]["type"],
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="string">
                                                String
                                            </SelectItem>
                                            <SelectItem value="number">
                                                Number
                                            </SelectItem>
                                            <SelectItem value="boolean">
                                                Boolean
                                            </SelectItem>
                                            <SelectItem value="array">
                                                Array
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px]">
                                    Description (Optional)
                                </Label>
                                <Input
                                    value={field.description || ""}
                                    onChange={(e) =>
                                        updateField(index, {
                                            description: e.target.value,
                                        })
                                    }
                                    className="h-7 text-xs"
                                    placeholder="What should this field contain?"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="border-border bg-muted/20 rounded-md border border-dashed py-4 text-center">
                    <p className="text-muted-foreground text-[10px]">
                        No fields defined yet.
                    </p>
                </div>
            )}
        </div>
    );
}

function LLMConfig({ data, nodeId }: { data: LLMData; nodeId: string }) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    const syncResponseSchema = useCallback(
        (visualSchema: LLMData["visualSchema"]) => {
            if (!visualSchema || visualSchema.length === 0) {
                updateNodeData(nodeId, {
                    visualSchema,
                    responseSchema: undefined,
                });
                return;
            }

            const properties: Record<string, unknown> = {};
            const required: string[] = [];

            visualSchema.forEach((field) => {
                let type: string = field.type;
                let items: Record<string, unknown> | undefined = undefined;

                if (field.type === "array") {
                    type = "array";
                    items = { type: "string" }; // Default to string array for now
                }

                properties[field.name] = {
                    type,
                    ...(field.description && {
                        description: field.description,
                    }),
                    ...(items && { items }),
                };

                if (field.required !== false) {
                    required.push(field.name);
                }
            });

            const schema = {
                type: "object",
                properties,
                required,
            };

            updateNodeData(nodeId, {
                visualSchema,
                responseSchema: JSON.stringify(schema, null, 2),
            });
        },
        [nodeId, updateNodeData],
    );

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="LLM name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                    value={data.model}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, { model: value })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={MODELS.TEXT.GEMINI_3_PRO_PREVIEW}>
                            Gemini 3 Pro Preview
                        </SelectItem>
                        <SelectItem value={MODELS.TEXT.GEMINI_3_FLASH_PREVIEW}>
                            Gemini 3 Flash Preview
                        </SelectItem>
                        <SelectItem value={MODELS.TEXT.GEMINI_2_5_PRO}>
                            Gemini 2.5 Pro
                        </SelectItem>
                        <SelectItem value={MODELS.TEXT.GEMINI_2_5_FLASH}>
                            Gemini 2.5 Flash
                        </SelectItem>
                        <SelectItem value={MODELS.TEXT.GEMINI_2_5_FLASH_LITE}>
                            Gemini 2.5 Flash Lite
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                    id="instructions"
                    value={data.instructions}
                    onChange={(e) =>
                        updateNodeData(nodeId, { instructions: e.target.value })
                    }
                    placeholder="System instructions for the LLM..."
                    rows={6}
                    className="font-mono text-xs"
                />
            </div>

            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label htmlFor="output-type">Output Format</Label>
                    <div className="text-muted-foreground text-[10px]">
                        Choose between raw text or structured JSON
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`text-xs ${data.outputType === "text" || !data.outputType ? "text-foreground font-medium" : "text-muted-foreground"}`}
                    >
                        Text
                    </span>
                    <Switch
                        id="output-type"
                        checked={data.outputType === "json"}
                        onCheckedChange={(checked) =>
                            updateNodeData(nodeId, {
                                outputType: checked ? "json" : "text",
                            })
                        }
                    />
                    <span
                        className={`text-xs ${data.outputType === "json" ? "text-foreground font-medium" : "text-muted-foreground"}`}
                    >
                        JSON
                    </span>
                </div>
            </div>

            {data.outputType === "json" && (
                <div className="border-border space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="strict-mode">Strict Mode</Label>
                            <div className="text-muted-foreground text-[10px]">
                                Enforce exact schema adherence
                            </div>
                        </div>
                        <Switch
                            id="strict-mode"
                            checked={data.strictMode}
                            onCheckedChange={(checked) =>
                                updateNodeData(nodeId, {
                                    strictMode: checked,
                                })
                            }
                        />
                    </div>

                    <SchemaEditor
                        visualSchema={data.visualSchema}
                        onChange={syncResponseSchema}
                    />

                    <Collapsible className="space-y-2">
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-2 text-[10px]"
                            >
                                <div className="flex items-center gap-2">
                                    <Code className="h-3 w-3" />
                                    Advanced: Raw JSON Schema
                                </div>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2">
                            <Textarea
                                value={data.responseSchema || ""}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    updateNodeData(nodeId, {
                                        responseSchema: newValue,
                                    });
                                    // Try to sync back to visual if it's valid JSON
                                    try {
                                        const parsed = JSON.parse(newValue);
                                        if (
                                            parsed.type === "object" &&
                                            parsed.properties
                                        ) {
                                            const properties =
                                                parsed.properties as Record<
                                                    string,
                                                    {
                                                        type?: string;
                                                        description?: string;
                                                    }
                                                >;
                                            const newVisualSchema: LLMData["visualSchema"] =
                                                Object.entries(properties).map(
                                                    ([name, config]) => ({
                                                        name,
                                                        type:
                                                            config.type ===
                                                                "number" ||
                                                            config.type ===
                                                                "boolean" ||
                                                            config.type ===
                                                                "array"
                                                                ? config.type
                                                                : "string", // Default to string for unknown types
                                                        description:
                                                            config.description,
                                                        required:
                                                            (
                                                                parsed.required as
                                                                    | string[]
                                                                    | undefined
                                                            )?.includes(name) ??
                                                            true,
                                                    }),
                                                );
                                            updateNodeData(nodeId, {
                                                visualSchema: newVisualSchema,
                                            });
                                        }
                                    } catch {
                                        // Ignore invalid JSON while typing
                                    }
                                }}
                                className="min-h-[150px] font-mono text-[10px]"
                                placeholder='{ "type": "object", ... }'
                            />
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            )}
        </div>
    );
}

function ImageConfig({ data, nodeId }: { data: ImageData; nodeId: string }) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );
    const [signedImageUrls, setSignedImageUrls] = useState<string[]>([]);

    useEffect(() => {
        const fetchSignedUrls = async () => {
            const urls = await Promise.all(
                data.images.map(async (image) => {
                    if (image.startsWith("gs://")) {
                        try {
                            const res = await fetch(
                                `/api/signed-url?gcsUri=${encodeURIComponent(image)}`,
                            );
                            const result = await res.json();
                            if (result.signedUrl) {
                                return result.signedUrl;
                            } else {
                                logger.error(
                                    `Failed to get signed URL: ${result.error}`,
                                );
                                return "/placeholder.svg";
                            }
                        } catch (error) {
                            logger.error("Error fetching signed URL:", error);
                            return "/placeholder.svg";
                        }
                    } else {
                        return image;
                    }
                }),
            );
            setSignedImageUrls(urls);
        };

        fetchSignedUrls();
    }, [data.images]);

    const addImage = () => {
        const newImages = [...data.images, "https://placeholder.com/300x300"];
        updateNodeData(nodeId, { images: newImages });
    };

    const removeImage = (index: number) => {
        const newImages = data.images.filter((_, i) => i !== index);
        updateNodeData(nodeId, { images: newImages });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="Image node name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                    id="prompt"
                    value={data.prompt}
                    onChange={(e) =>
                        updateNodeData(nodeId, { prompt: e.target.value })
                    }
                    placeholder="Image generation prompt..."
                    rows={4}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select
                    value={data.aspectRatio}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            aspectRatio: value as "16:9" | "9:16",
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                        <SelectItem value="1:1">1:1</SelectItem>
                        <SelectItem value="3:2">3:2</SelectItem>
                        <SelectItem value="2:3">2:3</SelectItem>
                        <SelectItem value="4:3">4:3</SelectItem>
                        <SelectItem value="3:4">3:4</SelectItem>
                        <SelectItem value="5:4">5:4</SelectItem>
                        <SelectItem value="4:5">4:5</SelectItem>
                        <SelectItem value="21:9">21:9</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                    value={data.model}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            model: value as ImageData["model"],
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE}>
                            Gemini 2.5 Flash Image
                        </SelectItem>
                        <SelectItem
                            value={MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW}
                        >
                            Gemini 3 Pro Image Preview
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select
                    value={data.resolution}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            resolution: value as "1K" | "2K",
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1K">1K</SelectItem>
                        <SelectItem value="2K">2K</SelectItem>
                        <SelectItem value="4K">4K</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label>Images</Label>
                    <Button
                        onClick={addImage}
                        size="sm"
                        variant="outline"
                        className="h-8 bg-transparent"
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Add Image
                    </Button>
                </div>

                {signedImageUrls.length > 0 ? (
                    <div className="space-y-2">
                        {signedImageUrls.map((image, index) => (
                            <div
                                key={index}
                                className="border-border bg-card flex items-center gap-2 rounded-md border p-2"
                            >
                                <Image
                                    src={image || "/placeholder.svg"}
                                    alt={`Image ${index + 1}`}
                                    width={48}
                                    height={48}
                                    className="rounded object-cover"
                                />
                                <span className="text-muted-foreground flex-1 truncate text-xs">
                                    {data.images[index]}
                                </span>
                                <Button
                                    onClick={() => removeImage(index)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                        No images added yet
                    </p>
                )}
            </div>
        </div>
    );
}

function VideoConfig({ data, nodeId }: { data: VideoData; nodeId: string }) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );
    const [signedRefImageUrls, setSignedRefImageUrls] = useState<string[]>([]);

    useEffect(() => {
        const fetchSignedUrls = async () => {
            const urls = await Promise.all(
                data.images.map(async (image) => {
                    if (image.startsWith("gs://")) {
                        try {
                            const res = await fetch(
                                `/api/signed-url?gcsUri=${encodeURIComponent(image)}`,
                            );
                            const result = await res.json();
                            if (result.signedUrl) {
                                return result.signedUrl;
                            } else {
                                logger.error(
                                    `Failed to get signed URL: ${result.error}`,
                                );
                                return "/placeholder.svg";
                            }
                        } catch (error) {
                            logger.error("Error fetching signed URL:", error);
                            return "/placeholder.svg";
                        }
                    } else {
                        return image;
                    }
                }),
            );
            setSignedRefImageUrls(urls);
        };

        fetchSignedUrls();
    }, [data.images]);

    const addImage = () => {
        const newImages = [...data.images, "https://placeholder.com/300x300"];
        updateNodeData(nodeId, { images: newImages });
    };

    const removeImage = (index: number) => {
        const newImages = data.images.filter((_, i) => i !== index);
        updateNodeData(nodeId, { images: newImages });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="Video node name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                    id="prompt"
                    value={data.prompt}
                    onChange={(e) =>
                        updateNodeData(nodeId, { prompt: e.target.value })
                    }
                    placeholder="Video generation prompt..."
                    rows={4}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select
                    value={data.aspectRatio}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            aspectRatio: value as "16:9" | "9:16",
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Select
                    value={String(data.duration)}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            duration: Number(value) as 4 | 6 | 8,
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="4">4 seconds</SelectItem>
                        <SelectItem value="6">6 seconds</SelectItem>
                        <SelectItem value="8">8 seconds</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                    value={data.model}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            model: value as VideoData["model"],
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={MODELS.VIDEO.VEO_3_1_FAST_PREVIEW}>
                            Veo 3.1 Fast Preview
                        </SelectItem>
                        <SelectItem value={MODELS.VIDEO.VEO_3_1_PRO_PREVIEW}>
                            Veo 3.1 Pro Preview
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="generateAudio">Generate Audio</Label>
                <Select
                    value={String(data.generateAudio)}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            generateAudio: value === "true",
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select
                    value={data.resolution}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            resolution: value as "720p" | "1080p" | "4k",
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p</SelectItem>
                        <SelectItem value="4k">4k</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label>Reference Images</Label>
                    <Button
                        onClick={addImage}
                        size="sm"
                        variant="outline"
                        className="h-8 bg-transparent"
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Add Image
                    </Button>
                </div>

                {signedRefImageUrls.length > 0 ? (
                    <div className="space-y-2">
                        {signedRefImageUrls.map((image, index) => (
                            <div
                                key={index}
                                className="border-border bg-card flex items-center gap-2 rounded-md border p-2"
                            >
                                <Image
                                    src={image || "/placeholder.svg"}
                                    alt={`Image ${index + 1}`}
                                    width={48}
                                    height={48}
                                    className="rounded object-cover"
                                />
                                <span className="text-muted-foreground flex-1 truncate text-xs">
                                    {data.images[index]}
                                </span>
                                <Button
                                    onClick={() => removeImage(index)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                        No images added yet
                    </p>
                )}
            </div>
        </div>
    );
}

function FileConfig({ data, nodeId }: { data: FileData; nodeId: string }) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );
    const [signedFileUrl, setSignedFileUrl] = useState<string | undefined>(
        undefined,
    );

    useEffect(() => {
        const fetchSignedUrl = async () => {
            if (data.fileUrl && data.fileUrl.startsWith("gs://")) {
                try {
                    const res = await fetch(
                        `/api/signed-url?gcsUri=${encodeURIComponent(data.fileUrl)}`,
                    );
                    const result = await res.json();
                    if (result.signedUrl) {
                        setSignedFileUrl(result.signedUrl);
                    } else {
                        logger.error(
                            `Failed to get signed URL: ${result.error}`,
                        );
                        setSignedFileUrl("/placeholder.svg");
                    }
                } catch (error) {
                    logger.error("Error fetching signed URL:", error);
                    setSignedFileUrl("/placeholder.svg");
                }
            } else if (data.fileUrl) {
                setSignedFileUrl(data.fileUrl);
            } else {
                setSignedFileUrl(undefined);
            }
        };

        fetchSignedUrl();
    }, [data.fileUrl]);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="File node name"
                />
            </div>

            <div className="space-y-2">
                <Label>File Type</Label>
                <div className="text-muted-foreground text-sm">
                    {data.fileType ? (
                        <span className="capitalize">{data.fileType}</span>
                    ) : (
                        "No file uploaded"
                    )}
                </div>
            </div>

            {data.fileName && (
                <div className="space-y-2">
                    <Label>File Name</Label>
                    <div className="text-muted-foreground text-sm break-all">
                        {data.fileName}
                    </div>
                </div>
            )}

            {data.fileUrl && (
                <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border-border overflow-hidden rounded-md border">
                        {data.fileType === "image" && signedFileUrl ? (
                            <Image
                                src={signedFileUrl}
                                alt={data.fileName}
                                width={300}
                                height={200}
                                className="h-auto w-full"
                            />
                        ) : data.fileType === "video" ? (
                            <video
                                src={signedFileUrl || data.fileUrl}
                                controls
                                className="h-auto w-full"
                            />
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}

function TextConfig({ data, nodeId }: { data: TextData; nodeId: string }) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="Text node name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="text">Text</Label>
                <Textarea
                    id="text"
                    value={data.text}
                    onChange={(e) =>
                        updateNodeData(nodeId, { text: e.target.value })
                    }
                    placeholder="Enter text content..."
                    rows={8}
                />
            </div>
        </div>
    );
}

function CustomWorkflowConfig({
    data,
    nodeId,
}: {
    data: CustomWorkflowData;
    nodeId: string;
}) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="Workflow name"
                />
            </div>
        </div>
    );
}

export function ConfigPanel() {
    const selectedNode = useFlowStore((state: FlowState) => state.selectedNode);

    if (!selectedNode) return null;

    const { data, id } = selectedNode;

    if (data.type === "llm") {
        return <LLMConfig data={data as LLMData} nodeId={id} />;
    }

    if (data.type === "text") {
        return <TextConfig data={data as TextData} nodeId={id} />;
    }

    if (data.type === "image") {
        return <ImageConfig data={data as ImageData} nodeId={id} />;
    }

    if (data.type === "video") {
        return <VideoConfig data={data as VideoData} nodeId={id} />;
    }

    if (data.type === "file") {
        return <FileConfig data={data as FileData} nodeId={id} />;
    }

    if (data.type === "custom-workflow") {
        return <CustomWorkflowConfig data={data} nodeId={id} />;
    }

    return null;
}
