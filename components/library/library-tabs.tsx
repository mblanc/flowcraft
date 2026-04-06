"use client";

import { Image, Video } from "lucide-react";

type LibraryTab = "images" | "videos";

interface LibraryTabsProps {
    activeTab: LibraryTab;
    onChange: (tab: LibraryTab) => void;
}

export function LibraryTabs({ activeTab, onChange }: LibraryTabsProps) {
    return (
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
            <button
                onClick={() => onChange("images")}
                className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "images"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                <Image className="h-4 w-4" />
                Images
            </button>
            <button
                onClick={() => onChange("videos")}
                className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "videos"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                <Video className="h-4 w-4" />
                Videos
            </button>
        </div>
    );
}
