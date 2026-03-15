"use client";

import type { LLMData } from "@/lib/types";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Plus, Trash2, List } from "lucide-react";

export function SchemaEditor({
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
