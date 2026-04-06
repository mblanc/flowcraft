"use client";

import { Workflow, PanelRight, ChevronRight } from "lucide-react";
import type { LibraryAssetProvenance } from "@/lib/library-types";

interface LibraryProvenanceProps {
    provenance: LibraryAssetProvenance;
}

export function LibraryProvenance({ provenance }: LibraryProvenanceProps) {
    const Icon = provenance.sourceType === "canvas" ? PanelRight : Workflow;

    return (
        <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Source
            </p>
            <div className="flex items-center gap-1 text-sm">
                <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span className="text-foreground font-medium">
                    {provenance.sourceName}
                </span>
                {provenance.nodeLabel && (
                    <>
                        <ChevronRight className="text-muted-foreground h-3 w-3" />
                        <span className="text-muted-foreground">
                            {provenance.nodeLabel}
                        </span>
                    </>
                )}
            </div>
            {provenance.prompt && (
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                    &ldquo;{provenance.prompt}&rdquo;
                </p>
            )}
        </div>
    );
}
