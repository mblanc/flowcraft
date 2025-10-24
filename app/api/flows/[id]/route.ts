import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getFirestore, COLLECTIONS } from "@/lib/firestore"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const firestore = getFirestore()
    const flowDoc = await firestore.collection(COLLECTIONS.FLOWS).doc(flowId).get()

    if (!flowDoc.exists) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }

    const flowData = flowDoc.data()

    // Verify ownership
    if (flowData?.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({
      id: flowDoc.id,
      ...flowData,
      createdAt: flowData?.createdAt?.toDate?.()?.toISOString() || flowData?.createdAt,
      updatedAt: flowData?.updatedAt?.toDate?.()?.toISOString() || flowData?.updatedAt,
    })
  } catch (error) {
    console.error("Error fetching flow:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const { name, nodes, edges } = body

    const firestore = getFirestore()
    const flowRef = firestore.collection(COLLECTIONS.FLOWS).doc(flowId)
    const flowDoc = await flowRef.get()

    if (!flowDoc.exists) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }

    const flowData = flowDoc.data()

    // Verify ownership
    if (flowData?.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updateData.name = name
    if (nodes !== undefined) updateData.nodes = nodes
    if (edges !== undefined) updateData.edges = edges

    await flowRef.update(updateData)

    const updatedDoc = await flowRef.get()
    const updatedData = updatedDoc.data()

    return NextResponse.json({
      id: flowDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString() || updatedData?.updatedAt,
    })
  } catch (error) {
    console.error("Error updating flow:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const firestore = getFirestore()
    const flowRef = firestore.collection(COLLECTIONS.FLOWS).doc(flowId)
    const flowDoc = await flowRef.get()

    if (!flowDoc.exists) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }

    const flowData = flowDoc.data()

    // Verify ownership
    if (flowData?.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await flowRef.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting flow:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

