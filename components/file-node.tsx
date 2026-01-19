"use client";

import type React from "react";

import { memo, useRef, useState, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { FileData } from "@/lib/types";
import { FileUp, ImageIcon, Video, FileText } from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import Image from "next/image";
import logger from "@/app/logger";
import { PdfPreview } from "./pdf-preview";

export const FileNode = memo(
    ({ data, selected, id }: NodeProps<Node<FileData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const [asyncSignedUrl, setAsyncSignedUrl] = useState<
            string | undefined
        >(undefined);
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

        return (
            <div
                className={`bg-card min-w-[220px] rounded-lg border-2 p-4 shadow-lg transition-all ${
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border"
                }`}
            >
                <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-cyan-500/10">
                        <FileUp className="h-5 w-5 text-cyan-400" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <h3 className="text-foreground mb-1 truncate text-sm font-semibold">
                            {data.name}
                        </h3>
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
                    <div className="border-border mt-3 overflow-hidden rounded-md border">
                        {data.fileType === "image" ? (
                            <Image
                                src={signedUrl}
                                alt={data.fileName || "File"}
                                width={200}
                                height={150}
                                className="h-auto max-h-[300px] w-full object-contain"
                            />
                        ) : data.fileType === "video" ? (
                            <video
                                src={signedUrl}
                                controls
                                className="h-auto max-h-[300px] w-full"
                            />
                        ) : data.fileType === "pdf" ? (
                            <PdfPreview
                                url={signedUrl}
                                className="h-auto max-h-[300px] min-h-[150px] w-full"
                            />
                        ) : null}
                    </div>
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
