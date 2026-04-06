"use client";

import { Search } from "lucide-react";

interface LibraryToolbarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export function LibraryToolbar({ searchQuery, onSearchChange }: LibraryToolbarProps) {
    return (
        <div className="relative w-full max-w-md">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
                type="text"
                placeholder="Search by prompt or tag..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border py-2 pr-4 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    );
}
