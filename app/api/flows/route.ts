import { NextResponse } from "next/server";
import { getFirestore, COLLECTIONS } from "@/lib/firestore";
import { withAuth, formatZodError } from "@/lib/api-utils";
import { FlowCreateSchema } from "@/lib/schemas";

export const GET = withAuth(async (_req, context, session) => {
    try {
        const firestore = getFirestore();
        const flowsRef = firestore.collection(COLLECTIONS.FLOWS);
        const userFlows = await flowsRef
            .where("userId", "==", session.user!.id)
            .orderBy("updatedAt", "desc")
            .get();

        const flows = userFlows.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt:
                doc.data().createdAt?.toDate?.()?.toISOString() ||
                doc.data().createdAt,
            updatedAt:
                doc.data().updatedAt?.toDate?.()?.toISOString() ||
                doc.data().updatedAt,
        }));

        return NextResponse.json({ flows });
    } catch (error) {
        console.error("Error fetching flows:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});

export const POST = withAuth(async (req, context, session) => {
    try {
        const body = await req.json();
        const result = FlowCreateSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formatZodError(result.error),
                },
                { status: 400 },
            );
        }

        const { name, nodes, edges } = result.data;

        const firestore = getFirestore();
        const flowsRef = firestore.collection(COLLECTIONS.FLOWS);

        const flowData = {
            userId: session.user!.id,
            name,
            nodes,
            edges,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const docRef = await flowsRef.add(flowData);

        return NextResponse.json({
            id: docRef.id,
            ...flowData,
            createdAt: flowData.createdAt.toISOString(),
            updatedAt: flowData.updatedAt.toISOString(),
        });
    } catch (error) {
        console.error("Error creating flow:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
});
