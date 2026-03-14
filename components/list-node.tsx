"use client";

import type React from "react";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { ListData } from "@/lib/types";
import {
    ListOrdered,
    Plus,
    Trash2,
    ImageIcon,
    FileText,
    FileUp,
    Loader2,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/use-flow-store";
import { NodeTitle } from "@/components/node-title";
import { cn } from "@/lib/utils";
import { Textarea } from "./ui/textarea";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import logger from "@/app/logger";
import { MediaViewer } from "@/components/media-viewer";

export const ListNode = memo(
    ({ data, selected, id }: NodeProps<Node<ListData>>) => {
        const updateNodeData = useFlowStore((state) => state.updateNodeData);
        const [localItems, setLocalItems] = useState<string[]>(data.items);
        const [prevDataItems, setPrevDataItems] = useState<string[]>(
            data.items,
        );
        const [dimensions, setDimensions] = useState({
            width: data.width || 320,
            height: data.height || 300,
        });
        const [prevDataWidth, setPrevDataWidth] = useState(data.width);
        const [prevDataHeight, setPrevDataHeight] = useState(data.height);
        const [isResizing, setIsResizing] = useState(false);
        const nodeRef = useRef<HTMLDivElement>(null);
        const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

        const [signedUrls, setSignedUrls] = useState<Record<string, string>>(
            {},
        );
        const [isUploading, setIsUploading] = useState<number | null>(null);
        const [isMediaOpen, setIsMediaOpen] = useState(false);
        const [mediaIndex, setMediaIndex] = useState(0);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const uploadIndexRef = useRef<number | null>(null);

        if (data.items !== prevDataItems) {
            setPrevDataItems(data.items);
            setLocalItems(data.items);
        }

        if (data.width !== prevDataWidth || data.height !== prevDataHeight) {
            setPrevDataWidth(data.width);
            setPrevDataHeight(data.height);
            setDimensions({
                width: data.width || 320,
                height: data.height || 300,
            });
        }

        useEffect(() => {
            if (data.itemType !== "image") return;

            let isMounted = true;
            const fetchSignedUrls = async () => {
                let hasChanges = false;
                const newSignedUrls = { ...signedUrls };

                for (const item of data.items) {
                    if (
                        item &&
                        item.startsWith("gs://") &&
                        !newSignedUrls[item]
                    ) {
                        try {
                            const res = await fetch(
                                `/api/signed-url?gcsUri=${encodeURIComponent(item)}`,
                            );
                            const result = await res.json();
                            if (result.signedUrl) {
                                newSignedUrls[item] = result.signedUrl;
                                hasChanges = true;
                            }
                        } catch (e) {
                            logger.error(
                                "Failed to fetch signed url string",
                                e,
                            );
                        }
                    }
                }

                if (hasChanges && isMounted) {
                    setSignedUrls(newSignedUrls);
                }
            };
            fetchSignedUrls();
            return () => {
                isMounted = false;
            };
        }, [data.items, data.itemType, signedUrls]);

        const resolveUrl = useCallback(
            (url: string) => {
                if (url?.startsWith("gs://")) {
                    return signedUrls[url] || "";
                }
                return url;
            },
            [signedUrls],
        );

        const syncItems = useCallback(
            (items: string[]) => {
                updateNodeData(id, { items });
            },
            [id, updateNodeData],
        );

        const handleItemChange = (index: number, value: string) => {
            const updated = [...localItems];
            updated[index] = value;
            setLocalItems(updated);
        };

        const handleItemBlur = () => {
            syncItems(localItems);
        };

        const handleAddItem = () => {
            const updated = [...localItems, ""];
            setLocalItems(updated);
            syncItems(updated);
        };

        const handleRemoveItem = (index: number) => {
            if (localItems.length <= 1) return;
            const updated = localItems.filter((_, i) => i !== index);
            setLocalItems(updated);
            syncItems(updated);

            // Adjust media index if needed when deleting
            if (mediaIndex >= updated.length) {
                setMediaIndex(Math.max(0, updated.length - 1));
            }
        };

        const handleItemTypeChange = (itemType: "text" | "image") => {
            updateNodeData(id, { itemType, items: [""] });
            setLocalItems([""]);
        };

        const handleUploadClick = (index: number) => {
            uploadIndexRef.current = index;
            fileInputRef.current?.click();
        };

        const handleFileChange = async (
            e: React.ChangeEvent<HTMLInputElement>,
        ) => {
            const file = e.target.files?.[0];
            const index = uploadIndexRef.current;
            if (!file || index === null) return;

            setIsUploading(index);
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("/api/upload-file", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) throw new Error("Upload failed");

                const dataResponse = await response.json();

                const updatedItems = [...localItems];
                updatedItems[index] =
                    dataResponse.gcsUri || dataResponse.signedUrl;

                if (dataResponse.gcsUri && dataResponse.signedUrl) {
                    setSignedUrls((prev) => ({
                        ...prev,
                        [dataResponse.gcsUri]: dataResponse.signedUrl,
                    }));
                }

                setLocalItems(updatedItems);
                syncItems(updatedItems);
            } catch (error) {
                logger.error("Upload error:", error);
                alert("Failed to upload image");
            } finally {
                setIsUploading(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                uploadIndexRef.current = null;
            }
        };

        const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
            resizeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                width: dimensions.width,
                height: dimensions.height,
            };
        };

        useEffect(() => {
            if (!isResizing) return;

            const handleMouseMove = (e: MouseEvent) => {
                const deltaX = e.clientX - resizeStartRef.current.x;
                const deltaY = e.clientY - resizeStartRef.current.y;
                const newWidth = Math.max(
                    220,
                    resizeStartRef.current.width + deltaX,
                );
                const newHeight = Math.max(
                    200,
                    resizeStartRef.current.height + deltaY,
                );
                setDimensions({ width: newWidth, height: newHeight });
            };

            const handleMouseUp = () => {
                setIsResizing(false);
                updateNodeData(id, {
                    width: dimensions.width,
                    height: dimensions.height,
                });
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);

            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }, [
            isResizing,
            id,
            updateNodeData,
            dimensions.width,
            dimensions.height,
        ]);

        return (
            <div
                ref={nodeRef}
                className={cn(
                    "bg-card relative rounded-lg border-2 p-4 shadow-lg transition-[border-color,shadow,background-color]",
                    selected
                        ? "border-primary shadow-primary/20"
                        : "border-border",
                )}
                style={{ width: dimensions.width }}
            >
                {"executing" in data && data.executing && (
                    <div
                        className="border-beam-glow"
                        style={
                            {
                                "--beam-color": "#14b8a6",
                            } as React.CSSProperties
                        }
                    />
                )}

                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-teal-500/10">
                        <ListOrdered className="h-5 w-5 text-teal-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <NodeTitle
                                name={data.name}
                                onRename={(n) =>
                                    updateNodeData(id, { name: n })
                                }
                                className="text-foreground mb-1"
                            />
                            <span className="text-muted-foreground rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
                                {localItems.length} item
                                {localItems.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() =>
                                            handleItemTypeChange("text")
                                        }
                                        className={cn(
                                            "flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
                                            data.itemType === "text"
                                                ? "bg-teal-500/20 text-teal-400"
                                                : "text-muted-foreground hover:bg-teal-500/10",
                                        )}
                                    >
                                        <FileText className="h-3 w-3" />
                                        Text
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>List of text items</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() =>
                                            handleItemTypeChange("image")
                                        }
                                        className={cn(
                                            "flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
                                            data.itemType === "image"
                                                ? "bg-teal-500/20 text-teal-400"
                                                : "text-muted-foreground hover:bg-teal-500/10",
                                        )}
                                    >
                                        <ImageIcon className="h-3 w-3" />
                                        Image
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>List of images</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                <div
                    className="nowheel nopan space-y-3 overflow-y-auto pr-1"
                    style={{ maxHeight: dimensions.height - 140 }}
                >
                    {localItems.map((item, index) => {
                        const isImageUrl = data.itemType === "image";
                        return (
                            <div
                                key={index}
                                className={cn(
                                    "group flex",
                                    isImageUrl
                                        ? "flex-col items-stretch gap-2"
                                        : "items-start gap-1",
                                )}
                            >
                                <div className="relative flex w-full items-start gap-1">
                                    <span className="text-muted-foreground mt-1.5 w-5 flex-shrink-0 text-right font-mono text-[10px]">
                                        {index + 1}.
                                    </span>
                                    {!isImageUrl ? (
                                        <Textarea
                                            value={item}
                                            onChange={(e) =>
                                                handleItemChange(
                                                    index,
                                                    e.target.value,
                                                )
                                            }
                                            onBlur={handleItemBlur}
                                            placeholder="Enter text..."
                                            className="nodrag nowheel nopan min-h-[32px] flex-1 resize-none border-none bg-transparent px-2 py-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                            rows={1}
                                        />
                                    ) : (
                                        <div className="flex flex-1 items-center justify-between px-2 pt-1">
                                            <span className="text-muted-foreground max-w-[150px] truncate text-[10px]">
                                                {item
                                                    ? item.startsWith("gs://")
                                                        ? item.split("/").pop()
                                                        : "Direct URL"
                                                    : "No image uploaded"}
                                            </span>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() =>
                                                            handleUploadClick(
                                                                index,
                                                            )
                                                        }
                                                        className="text-muted-foreground flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-teal-500/10 hover:text-teal-400 disabled:opacity-50"
                                                        disabled={
                                                            isUploading ===
                                                            index
                                                        }
                                                    >
                                                        {isUploading ===
                                                        index ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <FileUp className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>
                                                        {item
                                                            ? "Change Image"
                                                            : "Upload Image"}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleRemoveItem(index)}
                                        className={cn(
                                            "mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10",
                                            localItems.length <= 1 &&
                                                "pointer-events-none",
                                        )}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {isImageUrl && (
                                    <div className="relative ml-6 w-[calc(100%-1.5rem)]">
                                        <div
                                            className={cn(
                                                "border-border/50 flex h-32 w-full items-center justify-center overflow-hidden rounded-md border bg-black/5 transition-colors",
                                                item
                                                    ? "cursor-pointer hover:bg-black/10"
                                                    : "",
                                            )}
                                            onClick={() => {
                                                if (item) {
                                                    setMediaIndex(index);
                                                    setIsMediaOpen(true);
                                                } else {
                                                    handleUploadClick(index);
                                                }
                                            }}
                                        >
                                            {resolveUrl(item) ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img
                                                    src={resolveUrl(item)}
                                                    alt={`Item ${index + 1}`}
                                                    className="h-full w-full object-contain p-1"
                                                    onError={(e) => {
                                                        (
                                                            e.target as HTMLImageElement
                                                        ).style.display =
                                                            "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 opacity-40">
                                                    <ImageIcon className="text-muted-foreground h-8 w-8" />
                                                    <span className="text-[10px] font-medium">
                                                        Click to upload
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={handleAddItem}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-teal-500/30 py-1.5 text-[11px] font-medium text-teal-400 transition-colors hover:bg-teal-500/10"
                >
                    <Plus className="h-3 w-3" />
                    Add item
                </button>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                />

                {isMediaOpen && data.itemType === "image" && (
                    <MediaViewer
                        isOpen={isMediaOpen}
                        onOpenChange={setIsMediaOpen}
                        url={resolveUrl(localItems[mediaIndex])}
                        alt={`Image ${mediaIndex + 1}`}
                        type="image"
                        onPrev={
                            mediaIndex > 0
                                ? () => setMediaIndex(mediaIndex - 1)
                                : undefined
                        }
                        onNext={
                            mediaIndex < localItems.length - 1
                                ? () => setMediaIndex(mediaIndex + 1)
                                : undefined
                        }
                        currentIndex={mediaIndex}
                        totalCount={localItems.length}
                    />
                )}

                {/* Resize handle */}
                <div
                    className="nodrag absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
                    onMouseDown={handleResizeStart}
                    style={{ touchAction: "none" }}
                >
                    <div className="border-muted-foreground/30 absolute right-1 bottom-1 h-3 w-3 rounded-br border-r-2 border-b-2" />
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-teal-500"
                    id="list-output"
                />
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

ListNode.displayName = "ListNode";
