"use client";

import type React from "react";

import { memo, useRef, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { FileData } from "@/lib/types";
import { FileUp, ImageIcon, Video, FileText } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/node-title";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { MediaViewer } from "@/components/media-viewer";
import logger from "@/app/logger";
import { useNodeResize } from "@/hooks/use-node-resize";
import { useSignedUrl } from "@/hooks/use-signed-url";
import dynamic from "next/dynamic";

const PdfPreview = dynamic(
    () => import("./pdf-preview").then((mod) => mod.PdfPreview),
    {
        ssr: false,
    },
);

export const FileNode = memo(
    ({ data, selected, id }: NodeProps<Node<FileData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const [asyncSignedUrl, setAsyncSignedUrl] = useState<
            string | undefined
        >(undefined);
        const [isMediaOpen, setIsMediaOpen] = useState(false);

        const { dimensions, handleResizeStart } = useNodeResize(
            id,
            data.width,
            data.height,
            {
                defaultWidth: 220,
                defaultHeight: 300,
                minWidth: 220,
                minHeight: 300,
            },
        );

        const { signedUrl: gcsSignedUrl } = useSignedUrl(data.gcsUri);

        const signedUrl =
            (data.gcsUri?.startsWith("gs://")
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
                alert("Please upload an image, video, or PDF file");
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
                alert("Failed to upload file");
            }
        };

        const handleUploadClick = () => {
            fileInputRef.current?.click();
        };

        return (
            <div
                className={cn(
                    "bg-card relative rounded-lg border-2 p-4 shadow-lg transition-[border-color,shadow,background-color]",
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border",
                )}
                style={{ width: dimensions.width }}
            >
                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-cyan-500/10">
                        <FileUp className="h-5 w-5 text-cyan-400" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <NodeTitle
                                name={data.name}
                                onRename={(n) =>
                                    updateNodeData(id, { name: n })
                                }
                                className="text-foreground"
                            />
                            <div className="flex items-center gap-1">
                                {/* No action buttons */}
                            </div>
                        </div>
                        <div className="text-muted-foreground text-xs">
                            {data.fileName ? (
                                <span className="flex items-center gap-1">
                                    {data.fileType === "image" ? (
                                        <ImageIcon className="h-3 w-3" />
                                    ) : data.fileType === "video" ? (
                                        <Video className="h-3 w-3" />
                                    ) : data.fileType === "pdf" ? (
                                        <FileText className="h-3 w-3" />
                                    ) : null}
                                </span>
                            ) : (
                                "No file uploaded"
                            )}
                        </div>
                    </div>
                </div>

                {signedUrl && (
                    <>
                        <div
                            className="border-border mt-3 overflow-hidden rounded-md border"
                            style={{ maxHeight: dimensions.height - 150 }}
                        >
                            {data.fileType === "image" ? (
                                <div
                                    className="cursor-pointer transition-opacity hover:opacity-90"
                                    onClick={() => setIsMediaOpen(true)}
                                >
                                    <Image
                                        src={signedUrl}
                                        alt={data.fileName || "File"}
                                        width={dimensions.width - 32}
                                        height={dimensions.height - 150}
                                        className="h-auto w-full object-contain"
                                        style={{
                                            maxHeight: dimensions.height - 150,
                                        }}
                                        onContextMenu={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                </div>
                            ) : data.fileType === "video" ? (
                                <div className="relative">
                                    <video
                                        src={signedUrl}
                                        controls
                                        className="h-auto w-full"
                                        style={{
                                            maxHeight: dimensions.height - 150,
                                        }}
                                        onContextMenu={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                    <div
                                        className="absolute top-2 right-2 cursor-pointer rounded bg-black/50 p-1 transition-colors hover:bg-black/70"
                                        onClick={() => setIsMediaOpen(true)}
                                    >
                                        <ImageIcon className="h-4 w-4 text-white" />
                                    </div>
                                </div>
                            ) : data.fileType === "pdf" ? (
                                <PdfPreview
                                    url={signedUrl}
                                    className="h-full w-full"
                                />
                            ) : null}
                        </div>
                        {(data.fileType === "image" ||
                            data.fileType === "video") && (
                            <MediaViewer
                                isOpen={isMediaOpen}
                                onOpenChange={setIsMediaOpen}
                                url={signedUrl}
                                alt={data.fileName || "File"}
                                type={
                                    data.fileType === "video"
                                        ? "video"
                                        : "image"
                                }
                            />
                        )}
                    </>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                />

                <button
                    onClick={handleUploadClick}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
                >
                    <FileUp className="h-3 w-3" />
                    {signedUrl ? "Change File" : "Upload File"}
                </button>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-cyan-500"
                />

                {/* Resize handle */}
                <div
                    className="nodrag absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
                    onMouseDown={handleResizeStart}
                    style={{ touchAction: "none" }}
                >
                    <div className="border-muted-foreground/30 absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2" />
                </div>
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
