"use client";

import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import type { FileData } from "@/lib/types";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import Image from "next/image";
import { useSignedUrl } from "@/hooks/use-signed-url";

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
    const { displayUrl: signedFileUrl } = useSignedUrl(
        data.fileUrl || undefined,
    );

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
