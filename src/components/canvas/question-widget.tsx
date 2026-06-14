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
        <div className={cn("mt-2 space-y-2", answered && "opacity-50")}>
            <p className="text-foreground text-sm font-medium">
                {question.question}
            </p>

            <div className="flex flex-wrap gap-1.5">
                {question.options.map((option) => (
                    <Button
                        key={option.id}
                        variant="outline"
                        size="sm"
                        disabled={answered}
                        onClick={() => handleOption(option)}
                        className="h-auto py-1 text-xs"
                        title={option.description}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>

            {!answered && (
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSubmit();
                        }}
                        placeholder="Or type your own answer…"
                        disabled={answered}
                        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-7 flex-1 rounded-md border px-2 text-xs focus-visible:ring-1 focus-visible:outline-none disabled:opacity-50"
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
