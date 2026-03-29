"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import { useCanvasPersistence } from "@/hooks/use-canvas-persistence";
import logger from "@/app/logger";

function CanvasContent() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const setCanvas = useCanvasStore((s) => s.setCanvas);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const loadedCanvasId = useRef<string | null>(null);

    // Initialize auto-save
    useCanvasPersistence();

    const fetchCanvas = useCallback(
        async (id: string) => {
            try {
                const response = await fetch(`/api/canvases/${id}`);
                if (response.ok) {
                    const canvas = await response.json();
                    setCanvas(canvas);
                    setLoading(false);
                } else if (response.status === 404) {
                    setNotFound(true);
                    setLoading(false);
                } else {
                    logger.error("Error fetching canvas");
                    setLoading(false);
                }
            } catch (error) {
                logger.error("Error fetching canvas:", error);
                setLoading(false);
            }
        },
        [setCanvas],
    );

    useEffect(() => {
        const id = params.id as string;
        if (session && id && loadedCanvasId.current !== id) {
            loadedCanvasId.current = id;
            setTimeout(() => {
                void fetchCanvas(id);
            }, 0);
        }
    }, [session, params.id, fetchCanvas]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <h2 className="text-foreground mb-2 text-2xl font-semibold">
                        Canvas not found
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        This canvas doesn&apos;t exist or you don&apos;t have
                        permission to access it.
                    </p>
                    <button
                        onClick={() => router.push("/flows?tab=canvas")}
                        className="text-primary hover:underline"
                    >
                        Back to canvases
                    </button>
                </div>
            </div>
        );
    }

    return <CanvasEditor />;
}

export default function CanvasPage() {
    return <CanvasContent />;
}
