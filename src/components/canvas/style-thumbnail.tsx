"use client";

import { Palette } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { isGcsUri } from "@/lib/utils/gcs-uri";

interface StyleThumbnailProps {
    imageUri?: string | null;
    imageUrl?: string | null;
    className?: string;
    size?: "sm" | "md";
}

export function StyleThumbnail({
    imageUri,
    imageUrl: initialImageUrl,
    className,
    size = "sm",
}: StyleThumbnailProps) {
    // Determine which URL to use as the base for signed URL resolution
    const urlToResolve = initialImageUrl || imageUri || undefined;

    // Use the standard hook for signed URL resolution
    const { displayUrl } = useSignedUrl(urlToResolve);

    const sizeClasses = size === "sm" ? "h-8 w-8" : "h-10 w-10";
    const iconSizeClasses = size === "sm" ? "size-4" : "size-5";

    // Valid if we have a display URL and it's not a raw GCS URI
    const isValidUrl = displayUrl && !isGcsUri(displayUrl);

    if (!isValidUrl) {
        return (
            <div
                className={cn(
                    "bg-muted flex items-center justify-center rounded-md border",
                    sizeClasses,
                    className,
                )}
            >
                <Palette
                    className={cn("text-muted-foreground", iconSizeClasses)}
                />
            </div>
        );
    }

    return (
        <div
            className={cn(
                "bg-muted relative aspect-square shrink-0 overflow-hidden rounded-md border",
                sizeClasses,
                className,
            )}
        >
            <Image
                src={displayUrl!}
                alt="Style thumbnail"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 32px, 40px"
                unoptimized
            />
        </div>
    );
}
