"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { FileText, Loader2 } from "lucide-react";
import logger from "@/app/logger";

// Initialize PDF.js worker
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

interface PdfPreviewProps {
    url: string;
    className?: string;
}

export function PdfPreview({ url, className }: PdfPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function renderPreview() {
            if (!url) return;
            setLoading(true);
            setError(null);

            try {
                const loadingTask = pdfjs.getDocument(url);
                const pdf = await loadingTask.promise;

                if (!isMounted) return;

                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 0.5 });

                if (canvasRef.current && isMounted) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext("2d");

                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport,
                            canvas: canvas,
                        };

                        await page.render(renderContext).promise;
                    }
                }
                setLoading(false);
            } catch (err) {
                logger.error("Error rendering PDF preview:", err);
                if (isMounted) {
                    setError("Failed to load PDF preview");
                    setLoading(false);
                }
            }
        }

        renderPreview();

        return () => {
            isMounted = false;
        };
    }, [url]);

    if (error) {
        return (
            <div
                className={`bg-muted/30 flex flex-col items-center justify-center p-4 ${className}`}
            >
                <FileText className="text-muted-foreground h-8 w-8 opacity-50" />
                <span className="text-muted-foreground mt-2 line-clamp-2 text-center text-[10px]">
                    {error}
                </span>
            </div>
        );
    }

    return (
        <div
            className={`relative flex items-center justify-center overflow-hidden bg-white ${className}`}
        >
            {loading && (
                <div className="bg-muted/20 absolute inset-0 z-10 flex items-center justify-center">
                    <Loader2 className="text-primary h-5 w-5 animate-spin" />
                </div>
            )}
            <canvas
                ref={canvasRef}
                className="max-h-full max-w-full object-contain"
            />
        </div>
    );
}
