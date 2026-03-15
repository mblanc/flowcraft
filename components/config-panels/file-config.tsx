"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { FileData } from "@/lib/types";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import Image from "next/image";
import { useState, useEffect } from "react";
import logger from "@/app/logger";

export function FileConfig({
    data,
    nodeId,
}: {
    data: FileData;
    nodeId: string;
}) {
    const updateNodeData = useFlowStore(
        (state: FlowState) => state.updateNodeData,
    );
    const [signedFileUrl, setSignedFileUrl] = useState<string | undefined>(
        undefined,
    );

    useEffect(() => {
        const fetchSignedUrl = async () => {
            if (data.fileUrl && data.fileUrl.startsWith("gs://")) {
                try {
                    const res = await fetch(
                        `/api/signed-url?gcsUri=${encodeURIComponent(data.fileUrl)}`,
                    );
                    const result = await res.json();
                    if (result.signedUrl) {
                        setSignedFileUrl(result.signedUrl);
                    } else {
                        logger.error(
                            `Failed to get signed URL: ${result.error}`,
                        );
                        setSignedFileUrl("/placeholder.svg");
                    }
                } catch (error) {
                    logger.error("Error fetching signed URL:", error);
                    setSignedFileUrl("/placeholder.svg");
                }
            } else if (data.fileUrl) {
                setSignedFileUrl(data.fileUrl);
            } else {
                setSignedFileUrl(undefined);
            }
        };

        fetchSignedUrl();
    }, [data.fileUrl]);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) =>
                        updateNodeData(nodeId, { name: e.target.value })
                    }
                    placeholder="File node name"
                />
            </div>

            <div className="space-y-2">
                <Label>File Type</Label>
                <div className="text-muted-foreground text-sm">
                    {data.fileType ? (
                        <span className="capitalize">{data.fileType}</span>
                    ) : (
                        "No file uploaded"
                    )}
                </div>
            </div>

            {data.fileName && (
                <div className="space-y-2">
                    <Label>File Name</Label>
                    <div className="text-muted-foreground text-sm break-all">
                        {data.fileName}
                    </div>
                </div>
            )}

            {data.fileUrl && (
                <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border-border overflow-hidden rounded-md border">
                        {data.fileType === "image" && signedFileUrl ? (
                            <Image
                                src={signedFileUrl}
                                alt={data.fileName}
                                width={300}
                                height={200}
                                className="h-auto w-full"
                            />
                        ) : data.fileType === "video" ? (
                            <video
                                src={signedFileUrl || data.fileUrl}
                                controls
                                className="h-auto w-full"
                            />
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
