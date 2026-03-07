"use client";

import type React from "react";

import { memo, useRef, useState, useEffect, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { FileData } from "@/lib/types";
import {
    FileUp,
    Play,
    ChevronDown,
    FastForward,
    Loader2,
    Settings,
    ImageIcon,
    Video,
    FileText,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import Image from "next/image";
import { MediaViewer } from "@/components/media-viewer";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import logger from "@/app/logger";
import dynamic from "next/dynamic";
import { useFlowExecution } from "@/hooks/use-flow-execution";

const PdfPreview = dynamic(
    () => import("./pdf-preview").then((mod) => mod.PdfPreview),
    {
        ssr: false,
    },
);

export const FileNode = memo(
    ({ data, selected, id }: NodeProps<Node<FileData>>) => {
        const selectNode = useFlowStore((state) => state.selectNode);
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const { executeNode, runFromNode } = useFlowExecution();
        const fileInputRef = useRef<HTMLInputElement>(null);
        const [asyncSignedUrl, setAsyncSignedUrl] = useState<
            string | undefined
        >(undefined);
        const [isMediaOpen, setIsMediaOpen] = useState(false);
        const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
        const [prevGcsUri, setPrevGcsUri] = useState(data.gcsUri);
        const [prevFileUrl, setPrevFileUrl] = useState(data.fileUrl);

        if (data.gcsUri !== prevGcsUri || data.fileUrl !== prevFileUrl) {
            setPrevGcsUri(data.gcsUri);
            setPrevFileUrl(data.fileUrl);
            if (!data.gcsUri?.startsWith("gs://")) {
                setAsyncSignedUrl(undefined);
            }
        }

        const signedUrl =
            (data.gcsUri?.startsWith("gs://")
                ? asyncSignedUrl
                : data.fileUrl) || undefined;

        useEffect(() => {
            if (data.gcsUri && data.gcsUri.startsWith("gs://")) {
                fetch(
                    `/api/signed-url?gcsUri=${encodeURIComponent(data.gcsUri)}`,
                )
                    .then((res) => res.json())
                    .then((result) => {
                        if (result.signedUrl) {
                            setAsyncSignedUrl(result.signedUrl);
                        } else {
                            logger.error(
                                `Failed to get signed URL: ${result.error}`,
                            );
                            setAsyncSignedUrl(undefined);
                        }
                    })
                    .catch((error) => {
                        logger.error("Error fetching signed URL:", error);
                        setAsyncSignedUrl(undefined);
                    });
            }
        }, [data.gcsUri]);

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

        const handleExecute = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                executeNode(id);
            },
            [executeNode, id],
        );

        const handleRunFromHere = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                runFromNode(id);
            },
            [runFromNode, id],
        );

        return (
            <div
                className={`bg-card min-w-[220px] rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                }`}
            >
                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-cyan-500/10">
                        <FileUp className="h-5 w-5 text-cyan-400" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-foreground truncate text-sm font-semibold">
                                {data.name}
                            </h3>
                            <div className="flex items-center gap-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                selectNode(id);
                                                useFlowStore
                                                    .getState()
                                                    .setIsConfigSidebarOpen(
                                                        true,
                                                    );
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-cyan-400 transition-colors hover:bg-cyan-500/20"
                                        >
                                            <Settings className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Settings</p>
                                    </TooltipContent>
                                </Tooltip>
                                <button
                                    onClick={handleExecute}
                                    disabled={
                                        "executing" in data && data.executing
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Execute Node"
                                >
                                    {"executing" in data && data.executing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Play
                                            className="h-4 w-4"
                                            fill="currentColor"
                                        />
                                    )}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() =>
                                            setIsRunMenuOpen(!isRunMenuOpen)
                                        }
                                        disabled={
                                            "executing" in data &&
                                            data.executing
                                        }
                                        className={`flex h-8 w-8 items-center justify-center rounded-md text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${isRunMenuOpen ? "bg-cyan-500/20" : ""}`}
                                    >
                                        <ChevronDown
                                            className={`h-4 w-4 transition-transform ${isRunMenuOpen ? "rotate-180" : ""}`}
                                        />
                                    </button>
                                    {isRunMenuOpen && (
                                        <div className="bg-card border-border absolute right-0 z-10 mt-1 min-w-[120px] rounded-md border shadow-lg">
                                            <button
                                                onClick={(e) => {
                                                    handleRunFromHere(e);
                                                    setIsRunMenuOpen(false);
                                                }}
                                                disabled={
                                                    "executing" in data &&
                                                    data.executing
                                                }
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FastForward className="h-3 w-3" />
                                                Run from here
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                                    {data.fileName}
                                </span>
                            ) : (
                                "No file uploaded"
                            )}
                        </div>
                    </div>
                </div>

                {signedUrl && (
                    <>
                        <div className="border-border mt-3 overflow-hidden rounded-md border">
                            {data.fileType === "image" ? (
                                <div
                                    className="cursor-pointer transition-opacity hover:opacity-90"
                                    onClick={() => setIsMediaOpen(true)}
                                >
                                    <Image
                                        src={signedUrl}
                                        alt={data.fileName || "File"}
                                        width={200}
                                        height={150}
                                        className="h-auto max-h-[300px] w-full object-contain"
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
                                        className="h-auto max-h-[300px] w-full"
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
                                    className="h-auto max-h-[300px] min-h-[150px] w-full"
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
            </div>
        );
    },
);

FileNode.displayName = "FileNode";
