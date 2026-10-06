"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { VideoData } from "@/lib/types";
import { MODELS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MentionEditor } from "@/components/nodes/mention-editor";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import { useConnectedSourceNodes } from "@/hooks/use-connected-source-nodes";
import { isGcsUri } from "@/lib/utils/gcs-uri";
import { useSignedUrls } from "@/hooks/use-signed-url";

export function ConfigPanel({
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

    const validModels = Object.values(MODELS.VIDEO) as string[];
    const effectiveModel = validModels.includes(data.model)
        ? data.model
        : MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH;
    const isOmni =
        effectiveModel === MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH ||
        effectiveModel === MODELS.VIDEO.GEMINI_OMNI_FLASH;
    const normalizedResolution =
        (data.resolution as string) === "4k" ? "4K" : data.resolution || "720p";

    useEffect(() => {
        if (!validModels.includes(data.model)) {
            updateNodeData(nodeId, {
                model: MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeId]);

    useEffect(() => {
        const isOmni11 = effectiveModel === MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH;
        const isOmni10 = effectiveModel === MODELS.VIDEO.GEMINI_OMNI_FLASH;
        const updates: Partial<VideoData> = {};
        if (!data.resolution) {
            updates.resolution = "720p";
        } else if (isOmni10 && data.resolution !== "720p") {
            updates.resolution = "720p";
        } else if (!isOmni11 && data.resolution === "360p") {
            updates.resolution = "720p";
        }
        if (isOmni10 && data.duration !== undefined) {
            updates.duration = undefined;
        } else if (
            !isOmni &&
            data.duration !== undefined &&
            ![4, 6, 8].includes(data.duration)
        ) {
            updates.duration = 4;
        }
        if (Object.keys(updates).length > 0) {
            updateNodeData(nodeId, updates);
        }
    }, [
        data.model,
        data.resolution,
        data.duration,
        effectiveModel,
        isOmni,
        nodeId,
        updateNodeData,
    ]);

    const signedUrlsMap = useSignedUrls(data.images);
    const signedRefImageUrls = data.images.map(
        (img) => (isGcsUri(img) ? signedUrlsMap[img] : img) || "",
    );

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
                    value={
                        data.aspectRatio !== undefined
                            ? data.aspectRatio
                            : isOmni
                              ? "auto"
                              : "16:9"
                    }
                    disabled={isOmni && data.task === "edit"}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            aspectRatio:
                                value === "auto"
                                    ? undefined
                                    : (value as "16:9" | "9:16"),
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {isOmni && <SelectItem value="auto">Auto</SelectItem>}
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                    </SelectContent>
                </Select>
                {isOmni && data.task === "edit" && (
                    <p className="text-muted-foreground text-xs">
                        Aspect ratio cannot be set for edit tasks (inherited
                        from source).
                    </p>
                )}
            </div>

            {effectiveModel !== MODELS.VIDEO.GEMINI_OMNI_FLASH && (
                <div className="space-y-2">
                    <Label htmlFor="duration">Duration (seconds)</Label>
                    <Select
                        value={
                            data.duration !== undefined
                                ? String(data.duration)
                                : effectiveModel ===
                                    MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH
                                  ? "auto"
                                  : "4"
                        }
                        onValueChange={(value) =>
                            updateNodeData(nodeId, {
                                duration:
                                    value === "auto"
                                        ? undefined
                                        : (Number(
                                              value,
                                          ) as VideoData["duration"]),
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {effectiveModel ===
                                MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH && (
                                <SelectItem value="auto">Auto</SelectItem>
                            )}
                            {(effectiveModel ===
                            MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH
                                ? [3, 4, 5, 6, 7, 8, 9, 10]
                                : [4, 6, 8]
                            ).map((sec) => (
                                <SelectItem key={sec} value={String(sec)}>
                                    {sec} seconds
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                    value={effectiveModel}
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
                        <SelectItem value={MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH}>
                            Gemini Omni 1.1 Flash
                        </SelectItem>
                        <SelectItem value={MODELS.VIDEO.GEMINI_OMNI_FLASH}>
                            Gemini Omni Flash
                        </SelectItem>
                        <SelectItem value={MODELS.VIDEO.VEO_3_1_LITE}>
                            Veo 3.1 Lite
                        </SelectItem>
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
                    value={normalizedResolution}
                    onValueChange={(value) =>
                        updateNodeData(nodeId, {
                            resolution: value as VideoData["resolution"],
                        })
                    }
                    disabled={effectiveModel === MODELS.VIDEO.GEMINI_OMNI_FLASH}
                >
                    <SelectTrigger id="resolution">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {effectiveModel ===
                            MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH && (
                            <SelectItem value="360p">360p</SelectItem>
                        )}
                        <SelectItem value="720p">720p</SelectItem>
                        {effectiveModel !== MODELS.VIDEO.GEMINI_OMNI_FLASH && (
                            <>
                                <SelectItem value="1080p">1080p</SelectItem>
                                <SelectItem value="4K">4K</SelectItem>
                            </>
                        )}
                    </SelectContent>
                </Select>
            </div>

            {(effectiveModel === MODELS.VIDEO.GEMINI_OMNI_FLASH ||
                effectiveModel === MODELS.VIDEO.GEMINI_OMNI_1_1_FLASH) && (
                <div className="space-y-2">
                    <Label htmlFor="task">Task</Label>
                    <Select
                        value={data.task || "none"}
                        onValueChange={(value) =>
                            updateNodeData(nodeId, {
                                task: value as VideoData["task"],
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">
                                None (auto-infer)
                            </SelectItem>
                            <SelectItem value="text_to_video">
                                Text to Video
                            </SelectItem>
                            <SelectItem value="image_to_video">
                                Image to Video
                            </SelectItem>
                            <SelectItem value="reference_to_video">
                                Reference to Video
                            </SelectItem>
                            <SelectItem value="edit">Edit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

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
