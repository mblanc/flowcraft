"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { FlowCanvas } from "@/components/flow-canvas";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { useFlowStore } from "@/lib/store/use-flow-store";
import type { FlowState } from "@/lib/store/use-flow-store";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import logger from "@/app/logger";

function CustomNodeEditorContent() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const loadFlow = useFlowStore((state: FlowState) => state.loadFlow);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Ref to track the currently loaded ID to prevent re-fetching on tab switch
    const loadedNodeId = useRef<string | null>(null);

    const fetchCustomNode = useCallback(
        async (id: string) => {
            try {
                const response = await fetch(`/api/custom-nodes/${id}`);
                if (response.ok) {
                    const customNode = await response.json();
                    loadFlow(
                        id,
                        customNode.nodes,
                        customNode.edges,
                        customNode.name,
                        "custom-node",
                        {
                            ownerId: customNode.userId,
                        },
                    );
                    setLoading(false);
                } else if (response.status === 404) {
                    setNotFound(true);
                    setLoading(false);
                } else {
                    logger.error("Error fetching custom node");
                    setLoading(false);
                }
            } catch (error) {
                logger.error("Error fetching custom node:", error);
                setLoading(false);
            }
        },
        [loadFlow],
    );

    useEffect(() => {
        const id = params.id as string;

        // Only fetch if session exists, ID exists, AND we haven't loaded this ID yet
        if (session && id && loadedNodeId.current !== id) {
            loadedNodeId.current = id; // Mark this ID as loaded
            setTimeout(() => {
                void fetchCustomNode(id);
            }, 0);
        }
    }, [session, params.id, fetchCustomNode]);

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
                        Custom node not found
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        This custom node doesn&apos;t exist or you don&apos;t
                        have permission to access it.
                    </p>
                    <button
                        onClick={() => router.push("/flows")}
                        className="text-primary hover:underline"
                    >
                        Back to dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background flex h-screen flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                <FlowCanvas />
                <Sidebar />
            </div>
        </div>
    );
}

export default function CustomNodePage() {
    return <CustomNodeEditorContent />;
}
