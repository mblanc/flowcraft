"use client";

import Link from "next/link";
import { Workflow, PanelRight, ChevronRight } from "lucide-react";
import type { LibraryAssetProvenance } from "@/lib/library-types";
import { useSignedUrl } from "@/hooks/use-signed-url";

interface LibraryProvenanceProps {
    provenance: LibraryAssetProvenance;
}

export function LibraryProvenance({ provenance }: LibraryProvenanceProps) {
    const Icon = provenance.sourceType === "canvas" ? PanelRight : Workflow;
    const href =
        provenance.sourceType === "canvas"
            ? `/canvas/${provenance.sourceId}`
            : `/flow/${provenance.sourceId}`;

    return (
        <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Source
            </p>
            <div className="flex items-center gap-1 text-sm">
                <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <Link
                    href={href}
                    className="text-foreground font-medium hover:underline"
                >
                    {provenance.sourceName}
                </Link>
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
            {provenance.mediaInputs && provenance.mediaInputs.length > 0 && (
                <div className="mt-3 space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Input Media
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {provenance.mediaInputs.map((m, i) => (
                            <MediaInputThumbnail
                                key={i}
                                url={m.url}
                                mimeType={m.mimeType}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function MediaInputThumbnail({
    url,
    mimeType,
}: {
    url: string;
    mimeType?: string;
}) {
    const { displayUrl } = useSignedUrl(url);
    if (!displayUrl) {
        return <div className="bg-muted h-10 w-10 animate-pulse rounded" />;
    }
    if (mimeType?.startsWith("video/")) {
        return (
            <video
                src={displayUrl}
                className="border-border h-10 w-10 rounded border object-cover"
                muted
            />
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={displayUrl}
            alt="Input media"
            className="border-border h-10 w-10 rounded border object-cover"
        />
    );
}
