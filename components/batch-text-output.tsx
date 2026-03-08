"use client";

import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface BatchTextOutputProps {
    outputs: string[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
    maxHeight?: number;
    className?: string;
}

export const BatchTextOutput = memo(
    ({
        outputs,
        currentIndex,
        onIndexChange,
        maxHeight,
        className,
    }: BatchTextOutputProps) => {
        const handlePrev = () => {
            onIndexChange(
                currentIndex > 0 ? currentIndex - 1 : outputs.length - 1,
            );
        };

        const handleNext = () => {
            onIndexChange(
                currentIndex < outputs.length - 1 ? currentIndex + 1 : 0,
            );
        };

        return (
            <div className={className}>
                <div className="flex items-center justify-between px-1 py-1">
                    <button
                        onClick={handlePrev}
                        className="text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded transition-colors"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-muted-foreground text-[10px] font-medium">
                        {currentIndex + 1} / {outputs.length}
                    </span>
                    <button
                        onClick={handleNext}
                        className="text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded transition-colors"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
                <Textarea
                    value={outputs[currentIndex] || ""}
                    readOnly
                    className="nowheel nopan nodrag w-full resize-none border-none bg-transparent px-2 py-1 font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ height: maxHeight }}
                />
            </div>
        );
    },
);

BatchTextOutput.displayName = "BatchTextOutput";
