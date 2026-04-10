"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MODELS, IMAGE_MODEL_CONFIGS } from "@/lib/constants";

export interface AgentSettings {
    llmModel: string;
    imageModel: string;
    imageAspectRatio: string;
    imageResolution: string;
    videoModel: string;
    videoAspectRatio: string;
    videoResolution: string;
    videoDuration: string;
    videoGenerateAudio: boolean;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
    llmModel: MODELS.TEXT.GEMINI_3_FLASH_PREVIEW,
    imageModel: MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW,
    imageAspectRatio: "auto",
    imageResolution: "auto",
    videoModel: MODELS.VIDEO.VEO_3_1_LITE,
    videoAspectRatio: "auto",
    videoResolution: "auto",
    videoDuration: "auto",
    videoGenerateAudio: false,
};

const LLM_MODELS = [
    { id: MODELS.TEXT.GEMINI_3_FLASH_PREVIEW, label: "Gemini 3 Flash" },
    { id: MODELS.TEXT.GEMINI_3_1_PRO_PREVIEW, label: "Gemini 3.1 Pro" },
    {
        id: MODELS.TEXT.GEMINI_3_1_FLASH_LITE_PREVIEW,
        label: "Gemini 3.1 Flash Lite",
    },
];

const IMAGE_MODELS = [
    {
        id: MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW,
        label: "Nano Banana 2",
    },
    { id: MODELS.IMAGE.GEMINI_2_5_FLASH_IMAGE, label: "Nano Banana" },
    {
        id: MODELS.IMAGE.GEMINI_3_PRO_IMAGE_PREVIEW,
        label: "Nano Banana Pro",
    },
];

const VIDEO_MODELS = [
    { id: MODELS.VIDEO.VEO_3_1_LITE, label: "Veo 3.1 Lite" },
    { id: MODELS.VIDEO.VEO_3_1_FAST, label: "Veo 3.1 Fast" },
    { id: MODELS.VIDEO.VEO_3_1_PRO, label: "Veo 3.1 Pro" },
];

const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"];
const VIDEO_RESOLUTIONS = ["720p", "1080p"];
const VIDEO_DURATIONS = ["4", "6", "8"];

interface CanvasAgentSettingsDialogProps {
    settings: AgentSettings;
    onSettingsChange: (settings: AgentSettings) => void;
}

export function CanvasAgentSettingsDialog({
    settings,
    onSettingsChange,
}: CanvasAgentSettingsDialogProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<AgentSettings>(settings);

    const handleOpenChange = (next: boolean) => {
        if (next) {
            setDraft(settings);
        } else {
            onSettingsChange(draft);
        }
        setOpen(next);
    };

    const update = <K extends keyof AgentSettings>(
        key: K,
        value: AgentSettings[K],
    ) => {
        setDraft((prev) => {
            const next = { ...prev, [key]: value };
            // Reset image aspect ratio / resolution when model changes
            if (key === "imageModel") {
                const config =
                    IMAGE_MODEL_CONFIGS[
                        value as keyof typeof IMAGE_MODEL_CONFIGS
                    ];
                if (
                    config &&
                    next.imageAspectRatio !== "auto" &&
                    !(config.ratios as readonly string[]).includes(
                        next.imageAspectRatio,
                    )
                ) {
                    next.imageAspectRatio = "auto";
                }
                if (
                    config &&
                    next.imageResolution !== "auto" &&
                    !(config.resolutions as readonly string[]).includes(
                        next.imageResolution,
                    )
                ) {
                    next.imageResolution = "auto";
                }
            }
            return next;
        });
    };

    const imageModelConfig =
        IMAGE_MODEL_CONFIGS[
            draft.imageModel as keyof typeof IMAGE_MODEL_CONFIGS
        ] ?? IMAGE_MODEL_CONFIGS[MODELS.IMAGE.GEMINI_3_1_FLASH_IMAGE_PREVIEW];

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 shrink-0"
                    title="Agent settings"
                >
                    <Settings className="size-3.5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Agent Settings</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* LLM */}
                    <div className="space-y-3">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            Language Model
                        </p>
                        <div className="space-y-1.5">
                            <Label>Model</Label>
                            <Select
                                value={draft.llmModel}
                                onValueChange={(v) => update("llmModel", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LLM_MODELS.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="border-border border-t" />

                    {/* Image */}
                    <div className="space-y-3">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            Image Generation
                        </p>
                        <div className="space-y-1.5">
                            <Label>Model</Label>
                            <Select
                                value={draft.imageModel}
                                onValueChange={(v) => update("imageModel", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {IMAGE_MODELS.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Aspect Ratio</Label>
                                <Select
                                    value={draft.imageAspectRatio}
                                    onValueChange={(v) =>
                                        update("imageAspectRatio", v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">
                                            Auto
                                        </SelectItem>
                                        {imageModelConfig.ratios.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {r}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Resolution</Label>
                                <Select
                                    value={draft.imageResolution}
                                    onValueChange={(v) =>
                                        update("imageResolution", v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">
                                            Auto
                                        </SelectItem>
                                        {imageModelConfig.resolutions.map(
                                            (r) => (
                                                <SelectItem key={r} value={r}>
                                                    {r}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="border-border border-t" />

                    {/* Video */}
                    <div className="space-y-3">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            Video Generation
                        </p>
                        <div className="flex items-end gap-3">
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Label>Model</Label>
                                <Select
                                    value={draft.videoModel}
                                    onValueChange={(v) =>
                                        update("videoModel", v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VIDEO_MODELS.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex shrink-0 flex-col items-center gap-1.5 pb-0.5">
                                <Label className="text-xs">Audio</Label>
                                <Switch
                                    checked={draft.videoGenerateAudio}
                                    onCheckedChange={(v) =>
                                        update("videoGenerateAudio", v)
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label>Aspect Ratio</Label>
                                <Select
                                    value={draft.videoAspectRatio}
                                    onValueChange={(v) =>
                                        update("videoAspectRatio", v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">
                                            Auto
                                        </SelectItem>
                                        {VIDEO_ASPECT_RATIOS.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {r}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Resolution</Label>
                                <Select
                                    value={draft.videoResolution}
                                    onValueChange={(v) =>
                                        update("videoResolution", v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">
                                            Auto
                                        </SelectItem>
                                        {VIDEO_RESOLUTIONS.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {r}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Duration</Label>
                                <Select
                                    value={draft.videoDuration}
                                    onValueChange={(v) =>
                                        update("videoDuration", v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">
                                            Auto
                                        </SelectItem>
                                        {VIDEO_DURATIONS.map((d) => (
                                            <SelectItem key={d} value={d}>
                                                {d}s
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
