"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { LLMData } from "@/lib/types";
import { MODELS } from "@/lib/constants";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { MentionEditor } from "../nodes/mention-editor";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "../ui/collapsible";
import { Code, ChevronDown } from "lucide-react";
import { useCallback } from "react";
import { useConnectedSourceNodes } from "@/hooks/use-connected-source-nodes";
import { SchemaEditor } from "./schema-editor";

export function LLMConfig({ data, nodeId }: { data: LLMData; nodeId: string }) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );

    const connectedNodes = useConnectedSourceNodes(nodeId);

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
                    items = { type: "string" };
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
                        <SelectItem value={MODELS.TEXT.GEMINI_3_1_PRO_PREVIEW}>
                            Gemini 3.1 Pro Preview
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
                <Label>Instructions</Label>
                <div className="border-input bg-background focus-within:ring-ring rounded-md border px-3 py-2 text-xs focus-within:ring-1">
                    <MentionEditor
                        value={data.instructions}
                        onChange={(value) =>
                            updateNodeData(nodeId, { instructions: value })
                        }
                        availableNodes={connectedNodes}
                        placeholder="System instructions for the LLM..."
                        className="min-h-[7rem] font-mono"
                    />
                </div>
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
                                                                : "string",
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
