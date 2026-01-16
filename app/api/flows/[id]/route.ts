import { NextResponse } from "next/server";
import { getFirestore, COLLECTIONS } from "@/lib/firestore";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { FlowUpdateSchema } from "@/lib/schemas";

export const GET = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: flowId } = (await params) as { id: string };
        try {
            const firestore = getFirestore();
            const flowDoc = await firestore
                .collection(COLLECTIONS.FLOWS)
                .doc(flowId)
                .get();

            if (!flowDoc.exists) {
                return NextResponse.json(
                    { error: "Flow not found" },
                    { status: 404 },
                );
            }

            const flowData = flowDoc.data();

            // Verify ownership
            if (flowData?.userId !== session.user!.id) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 403 },
                );
            }

            return NextResponse.json({
                id: flowDoc.id,
                ...flowData,
                createdAt:
                    flowData?.createdAt?.toDate?.()?.toISOString() ||
                    flowData?.createdAt,
                updatedAt:
                    flowData?.updatedAt?.toDate?.()?.toISOString() ||
                    flowData?.updatedAt,
            });
        } catch (error) {
            console.error("Error fetching flow:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);

export const PUT = withAuth<{ params: Promise<{ id: string }> }>(
    async (req, { params }, session) => {
        const { id: flowId } = (await params) as { id: string };
        try {
            const body = await req.json();
            const result = FlowUpdateSchema.safeParse(body);

            if (!result.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: formatZodError(result.error),
                    },
                    { status: 400 },
                );
            }

            const { name, nodes, edges, thumbnail } = result.data;

            const firestore = getFirestore();
            const flowRef = firestore.collection(COLLECTIONS.FLOWS).doc(flowId);
            const flowDoc = await flowRef.get();

            if (!flowDoc.exists) {
                return NextResponse.json(
                    { error: "Flow not found" },
                    { status: 404 },
                );
            }

            const flowData = flowDoc.data();

            // Verify ownership
            if (flowData?.userId !== session.user!.id) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 403 },
                );
            }

            const updateData: Record<string, unknown> = {
                updatedAt: new Date(),
            };

            if (name !== undefined) updateData.name = name;
            if (nodes !== undefined) updateData.nodes = nodes;
            if (edges !== undefined) updateData.edges = edges;
            if (thumbnail !== undefined) updateData.thumbnail = thumbnail;

            await flowRef.update(updateData);

            const updatedDoc = await flowRef.get();
            const updatedData = updatedDoc.data();

            return NextResponse.json({
                id: flowDoc.id,
                ...updatedData,
                createdAt:
                    updatedData?.createdAt?.toDate?.()?.toISOString() ||
                    updatedData?.createdAt,
                updatedAt:
                    updatedData?.updatedAt?.toDate?.()?.toISOString() ||
                    updatedData?.updatedAt,
            });
        } catch (error) {
            console.error("Error updating flow:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);

export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }, session) => {
        const { id: flowId } = (await params) as { id: string };
        try {
            const firestore = getFirestore();
            const flowRef = firestore.collection(COLLECTIONS.FLOWS).doc(flowId);
            const flowDoc = await flowRef.get();

            if (!flowDoc.exists) {
                return NextResponse.json(
                    { error: "Flow not found" },
                    { status: 404 },
                );
            }

            const flowData = flowDoc.data();

            // Verify ownership
            if (flowData?.userId !== session.user!.id) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 403 },
                );
            }

            await flowRef.delete();

            return NextResponse.json({ success: true });
        } catch (error) {
            console.error("Error deleting flow:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    },
);
