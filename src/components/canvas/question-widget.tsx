"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionPayload } from "@/lib/canvas/types";

interface QuestionWidgetProps {
    question: QuestionPayload;
    onAnswer: (answer: string) => void;
    answered: boolean;
}

export function QuestionWidget({
    question,
    onAnswer,
    answered,
}: QuestionWidgetProps) {
    const [freeText, setFreeText] = useState("");

    const handleOption = (option: { label: string; description?: string }) => {
        if (answered) return;
        const answer = option.description
            ? `${option.label} — ${option.description}`
            : option.label;
        onAnswer(answer);
    };

    const handleSubmit = () => {
        const trimmed = freeText.trim();
        if (!trimmed || answered) return;
        onAnswer(trimmed);
        setFreeText("");
    };

    return (
        <div
            className={cn(
                "border-border bg-muted/40 mt-3 rounded-lg border p-3",
                answered && "opacity-60",
            )}
        >
            <p className="text-foreground mb-3 text-xs font-medium">
                {question.question}
            </p>

            <div className="flex flex-col gap-1.5">
                {question.options.map((option) => (
                    <Button
                        key={option.id}
                        variant="outline"
                        size="sm"
                        disabled={answered}
                        onClick={() => handleOption(option)}
                        className="bg-background hover:bg-accent h-auto w-full justify-start px-3 py-2 text-left text-xs"
                        title={option.description}
                    >
                        <span className="flex flex-col items-start gap-0.5">
                            <span>{option.label}</span>
                            {option.description && (
                                <span className="text-muted-foreground font-normal">
                                    {option.description}
                                </span>
                            )}
                        </span>
                    </Button>
                ))}
            </div>

            {!answered && (
                <div className="border-border mt-3 flex gap-1.5 border-t pt-3">
                    <input
                        type="text"
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSubmit();
                        }}
                        placeholder="Or type your own answer…"
                        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-7 flex-1 rounded-md border px-2 text-xs focus-visible:ring-1 focus-visible:outline-none"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!freeText.trim()}
                        onClick={handleSubmit}
                        className="h-7 px-2 text-xs"
                    >
                        Send
                    </Button>
                </div>
            )}
        </div>
    );
}
