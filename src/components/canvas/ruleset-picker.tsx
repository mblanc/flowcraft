"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, X, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import type { RulesetDocument } from "@/lib/services/ruleset.service";
import logger from "@/app/logger";

export function RulesetPicker() {
    const canvasId = useCanvasStore((s) => s.canvasId);
    const activeRulesetId = useCanvasStore((s) => s.activeRulesetId);
    const activeRulesetName = useCanvasStore((s) => s.activeRulesetName);
    const setActiveRuleset = useCanvasStore((s) => s.setActiveRuleset);

    const [rulesets, setRulesets] = useState<RulesetDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);

    async function fetchRulesets() {
        setLoading(true);
        try {
            const res = await fetch("/api/rulesets?tab=my");
            if (!res.ok) return;
            const data = (await res.json()) as { rulesets: RulesetDocument[] };
            setRulesets(data.rulesets);
        } catch (err) {
            logger.error("[RulesetPicker] Fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setTimeout(() => {
            void fetchRulesets();
        }, 0);
    }, []);

    async function applyRuleset(ruleset: RulesetDocument | null) {
        if (!canvasId) return;
        setApplying(true);
        try {
            const body = ruleset
                ? {
                      activeRulesetId: ruleset.id,
                      activeRulesetName: ruleset.name,
                  }
                : { activeRulesetId: null, activeRulesetName: null };

            const res = await fetch(`/api/canvases/${canvasId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("Failed to update canvas");

            setActiveRuleset(ruleset?.id ?? null, ruleset?.name ?? null);
        } catch (err) {
            logger.error("[RulesetPicker] Apply failed:", err);
        } finally {
            setApplying(false);
        }
    }

    return (
        <div className="flex items-center gap-2">
            <ShieldCheck className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="text-muted-foreground text-xs">Ruleset:</span>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 max-w-[160px] truncate text-xs"
                        disabled={applying || loading}
                    >
                        {applying ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        <span className="truncate">
                            {activeRulesetName ?? "No ruleset"}
                        </span>
                        <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    {loading ? (
                        <div className="flex justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : rulesets.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-1.5 text-xs">
                            No rulesets yet
                        </div>
                    ) : (
                        rulesets.map((r) => (
                            <DropdownMenuItem
                                key={r.id}
                                onSelect={() => void applyRuleset(r)}
                                className={
                                    activeRulesetId === r.id
                                        ? "font-medium"
                                        : undefined
                                }
                            >
                                <span className="truncate">{r.name}</span>
                                <span className="text-muted-foreground ml-auto text-[10px]">
                                    {r.rules.length}
                                </span>
                            </DropdownMenuItem>
                        ))
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {activeRulesetId && (
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    onClick={() => void applyRuleset(null)}
                    aria-label="Remove ruleset"
                    disabled={applying}
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}
