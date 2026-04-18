"use client";

import type React from "react";

import { memo, useRef, useState, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { FileData } from "@/lib/types";
import { FileUp, ImageIcon, Video, FileText } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/nodes/node-title";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { MediaViewer } from "@/components/nodes/media-viewer";
import logger from "@/app/logger";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { NodeResizeHandle } from "@/components/nodes/node-resize-handle";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { isGcsUri } from "@/lib/gcs-uri";

const PdfPreview = dynamic(
    () => import("./pdf-preview").then((mod) => mod.PdfPreview),
    {
        ssr: false,
    },
);

export const FileNode = memo(
    ({ data, selected, id }: NodeProps<Node<FileData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const deleteNode = useFlowStore((state) => state.deleteNode);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const [asyncSignedUrl, setAsyncSignedUrl] = useState<
            string | undefined
        >(undefined);
        const [isMediaOpen, setIsMediaOpen] = useState(false);
        const [isHovered, setIsHovered] = useState(false);
        const [mediaAspectRatio, setMediaAspectRatio] = useState<
            number | undefined
        >(undefined);

        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 240,
                defaultHeight: 240,
                minWidth: 200,
                minHeight: 200,
                lockedAspectRatio: mediaAspectRatio,
            },
        );

        const isActive = selected || isHovered;

        const { signedUrl: gcsSignedUrl } = useSignedUrl(data.gcsUri);

        const signedUrl =
            (isGcsUri(data.gcsUri)
                ? (gcsSignedUrl ?? asyncSignedUrl)
                : data.fileUrl) || undefined;

        const handleFileChange = async (
            e: React.ChangeEvent<HTMLInputElement>,
        ) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const fileType = file.type.startsWith("image/")
                ? "image"
                : file.type.startsWith("video/")
                  ? "video"
                  : file.type === "application/pdf"
                    ? "pdf"
                    : null;

            if (!fileType) {
                toast.error("Please upload an image, video, or PDF file");
                return;
            }

            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("/api/upload-file", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error("Upload failed");
                }

                const data = await response.json();

                updateNodeData(id, {
                    fileUrl: data.signedUrl,
                    gcsUri: data.gcsUri,
                    fileName: file.name,
                    fileType,
                });
                setAsyncSignedUrl(data.signedUrl);
            } catch (error) {
                logger.error("Upload error:", error);
                toast.error("Failed to upload file");
            }
        };

        const handleMediaLoad = useCallback(
            (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
                const el = e.currentTarget;
                const w =
                    el instanceof HTMLVideoElement
                        ? el.videoWidth
                        : (el as HTMLImageElement).naturalWidth;
                const h =
                    el instanceof HTMLVideoElement
                        ? el.videoHeight
                        : (el as HTMLImageElement).naturalHeight;
                if (w && h) {
                    const ratio = w / h;
                    setMediaAspectRatio(ratio);
                    updateNodeData(id, {
                        height: Math.round(dimensions.width / ratio),
                    });
                }
            },
            [dimensions.width, id, updateNodeData],
        );

        const handleUploadClick = () => {
            fileInputRef.current?.click();
        };

        const handleDelete = useCallback(
            () => deleteNode(id),
            [deleteNode, id],
        );

        const handleDownload = useCallback(() => {
            if (!signedUrl) return;
            const a = document.createElement("a");
            a.href = signedUrl;
            a.download = data.fileName || "file";
            a.click();
        }, [signedUrl, data.fileName]);

        return (
            <div
                className="relative"
                style={{ width: dimensions.width, height: dimensions.height }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Floating title */}
                <div className="pointer-events-auto absolute -top-7 left-2 z-20 flex items-center">
                    <NodeTitle
                        name={data.name}
                        onRename={(n) => updateNodeData(id, { name: n })}
                        className="text-foreground text-xs"
                    />
                </div>

                {/* Action bar */}
                <NodeActionBar
                    isVisible={isActive}
                    onFullscreen={
                        signedUrl &&
                        (data.fileType === "image" || data.fileType === "video")
                            ? () => setIsMediaOpen(true)
                            : undefined
                    }
                    onDownload={signedUrl ? handleDownload : undefined}
                    onDelete={handleDelete}
                />

                {/* Media box */}
                <div
                    className={cn(
                        "bg-card relative h-full w-full overflow-hidden rounded-lg border transition-[border-color,border-width] duration-150",
                        selected
                            ? "border-primary border-2"
                            : "border-border border",
                    )}
                >
                    {/* Content */}
                    {signedUrl ? (
                        <>
                            {data.fileType === "image" ? (
                                <div
                                    className="h-full cursor-pointer"
                                    onClick={() => setIsMediaOpen(true)}
                                >
                                    <Image
                                        src={signedUrl}
                                        alt={data.fileName || "File"}
                                        width={dimensions.width}
                                        height={dimensions.height}
                                        className="h-full w-full object-contain"
                                        onLoad={handleMediaLoad}
                                        onContextMenu={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                </div>
                            ) : data.fileType === "video" ? (
                                <video
                                    src={signedUrl}
                                    controls
                                    className="h-full w-full object-contain"
                                    onLoadedMetadata={handleMediaLoad}
                                    onContextMenu={(e) => e.stopPropagation()}
                                />
                            ) : data.fileType === "pdf" ? (
                                <PdfPreview
                                    url={signedUrl}
                                    className="h-full w-full"
                                />
                            ) : null}
                        </>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3">
                            <FileUp className="text-muted-foreground/30 h-8 w-8" />
                            <span className="text-muted-foreground text-xs">
                                No file uploaded
                            </span>
                        </div>
                    )}
                </div>

                {/* Params panel — floating below media box */}
                <div
                    className={cn(
                        "border-border bg-card absolute inset-x-0 z-20 rounded-lg border px-3 py-2 shadow-sm transition-opacity duration-150",
                        isActive
                            ? "opacity-100"
                            : "pointer-events-none opacity-0",
                    )}
                    style={{ top: dimensions.height + 8 }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                            {data.fileType === "image" ? (
                                <ImageIcon className="h-3 w-3" />
                            ) : data.fileType === "video" ? (
                                <Video className="h-3 w-3" />
                            ) : data.fileType === "pdf" ? (
                                <FileText className="h-3 w-3" />
                            ) : null}
                            <span className="max-w-[120px] truncate">
                                {data.fileName || "No file"}
                            </span>
                        </div>
                        <button
                            onClick={handleUploadClick}
                            className="bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
                        >
                            <FileUp className="h-3 w-3" />
                            {signedUrl ? "Change" : "Upload"}
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                />

                {signedUrl &&
                    (data.fileType === "image" ||
                        data.fileType === "video") && (
                        <MediaViewer
                            isOpen={isMediaOpen}
                            onOpenChange={setIsMediaOpen}
                            url={signedUrl}
                            alt={data.fileName || "File"}
                            type={data.fileType === "video" ? "video" : "image"}
                        />
                    )}

                <Handle
                    type="source"
                    position={Position.Right}
                    className="bg-cyan-500"
                />

                <NodeResizeHandle onResizeStart={handleResizeStart} />
            </div>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.id === nextProps.id &&
            prevProps.selected === nextProps.selected &&
            prevProps.data === nextProps.data
        );
    },
);

FileNode.displayName = "FileNode";
