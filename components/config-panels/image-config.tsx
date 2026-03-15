"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { ImageData } from "@/lib/types";
import { MODELS } from "@/lib/constants";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { MentionEditor } from "../mention-editor";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import logger from "@/app/logger";
import { useConnectedSourceNodes } from "@/hooks/use-connected-source-nodes";

const IMAGE_MODEL_CONFIGS = {
    [MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE]: {
        ratios: [
            "1:1",
            "3:2",
            "2:3",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "21:9",
        ],
        resolutions: ["1K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW]: {
        ratios: [
            "1:1",
            "3:2",
            "2:3",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "21:9",
        ],
        resolutions: ["1K", "2K", "4K"],
        grounding: { google: true, image: false },
    },
    [MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW]: {
        ratios: [
            "1:1",
            "1:4",
            "1:8",
            "3:2",
            "2:3",
            "3:4",
            "4:1",
            "4:3",
            "4:5",
            "5:4",
            "8:1",
            "9:16",
            "16:9",
            "21:9",
        ],
        resolutions: ["512", "1K", "2K", "4K"],
        grounding: { google: true, image: true },
    },
} as const;

export function ImageConfig({
    data,
    nodeId,
}: {
    data: ImageData;
    nodeId: string;
}) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    const connectedNodes = useConnectedSourceNodes(nodeId);

    const [signedImageUrls, setSignedImageUrls] = useState<string[]>([]);

    const currentModelConfig =
        IMAGE_MODEL_CONFIGS[data.model as keyof typeof IMAGE_MODEL_CONFIGS] ||
        IMAGE_MODEL_CONFIGS[MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW];

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

    const handleModelChange = (value: string) => {
        const newModel = value as keyof typeof IMAGE_MODEL_CONFIGS;
        const config = IMAGE_MODEL_CONFIGS[newModel];
        const updates: Partial<ImageData> = { model: newModel };

        if (!(config.ratios as readonly string[]).includes(data.aspectRatio)) {
            updates.aspectRatio = config.ratios[0] as ImageData["aspectRatio"];
        }

        if (
            !(config.resolutions as readonly string[]).includes(data.resolution)
        ) {
            updates.resolution = config
                .resolutions[0] as ImageData["resolution"];
        }

        if (!config.grounding.google) updates.groundingGoogleSearch = false;
        if (!config.grounding.image) updates.groundingImageSearch = false;

        updateNodeData(nodeId, updates);
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
                <Label>Prompt</Label>
                <div className="border-input bg-background focus-within:ring-ring rounded-md border px-3 py-2 text-sm focus-within:ring-1">
                    <MentionEditor
                        value={data.prompt}
                        onChange={(value) =>
                            updateNodeData(nodeId, { prompt: value })
                        }
                        availableNodes={connectedNodes}
                        placeholder="Image generation prompt..."
                        className="min-h-[5rem]"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={data.model} onValueChange={handleModelChange}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE}>
                            Nano Banana (Gemini 2.5 Flash Image)
                        </SelectItem>
                        <SelectItem
                            value={MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW}
                        >
                            Nano Banana Pro (Gemini 3 Pro Image Preview)
                        </SelectItem>
                        <SelectItem
                            value={MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW}
                        >
                            Nano Banana 2 (Gemini 3.1 Flash Image Preview)
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select
                    value={data.aspectRatio}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            aspectRatio: value as ImageData["aspectRatio"],
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {currentModelConfig.ratios.map((ratio) => (
                            <SelectItem key={ratio} value={ratio}>
                                {ratio}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select
                    value={data.resolution}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            resolution: value as ImageData["resolution"],
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {currentModelConfig.resolutions.map((res) => (
                            <SelectItem key={res} value={res}>
                                {res}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="border-border space-y-4 border-t pt-4">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Grounding Options
                </Label>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="google-search">Google Search</Label>
                        <div className="text-muted-foreground text-[10px]">
                            Use Google Search for grounding
                        </div>
                    </div>
                    <Switch
                        id="google-search"
                        disabled={!currentModelConfig.grounding.google}
                        checked={data.groundingGoogleSearch}
                        onCheckedChange={(checked) =>
                            updateNodeData(nodeId, {
                                groundingGoogleSearch: checked,
                            })
                        }
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="image-search">Image Search</Label>
                        <div className="text-muted-foreground text-[10px]">
                            Use Image Search for grounding
                        </div>
                    </div>
                    <Switch
                        id="image-search"
                        disabled={!currentModelConfig.grounding.image}
                        checked={data.groundingImageSearch}
                        onCheckedChange={(checked) =>
                            updateNodeData(nodeId, {
                                groundingImageSearch: checked,
                            })
                        }
                    />
                </div>
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
