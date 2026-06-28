"use client";

import { ShieldCheck } from "lucide-react";
import { RulesetList } from "@/components/ruleset/ruleset-list";

export default function RulesetsPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-3">
                <ShieldCheck className="text-muted-foreground h-6 w-6" />
                <div>
                    <h1 className="text-xl font-semibold">Rulesets</h1>
                    <p className="text-muted-foreground text-sm">
                        Define validation rules for canvas image generation.
                    </p>
                </div>
            </div>
            <div className="max-w-2xl">
                <RulesetList />
            </div>
        </div>
    );
}
