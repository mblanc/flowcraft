"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { VideoData } from "@/lib/types";
import { MODELS } from "@/lib/constants";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { MentionEditor } from "../nodes/mention-editor";
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

export function VideoConfig({
    data,
    nodeId,
}: {
    data: VideoData;
    nodeId: string;
}) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    const connectedTextNodes = useConnectedSourceNodes(nodeId, "prompt-input");

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
                <Label>Prompt</Label>
                <div className="border-input bg-background focus-within:ring-ring rounded-md border px-3 py-2 text-sm focus-within:ring-1">
                    <MentionEditor
                        value={data.prompt}
                        onChange={(value) =>
                            updateNodeData(nodeId, { prompt: value })
                        }
                        availableNodes={connectedTextNodes}
                        placeholder="Video generation prompt..."
                        className="min-h-[5rem]"
                    />
                </div>
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
                        <SelectItem value={MODELS.VIDEO.VEO_3_1_FAST}>
                            Veo 3.1 Fast
                        </SelectItem>
                        <SelectItem value={MODELS.VIDEO.VEO_3_1_PRO}>
                            Veo 3.1 Pro
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
