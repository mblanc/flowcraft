import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getFirestore, COLLECTIONS } from "@/lib/firestore"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const firestore = getFirestore()
    const flowsRef = firestore.collection(COLLECTIONS.FLOWS)
    const userFlows = await flowsRef.where("userId", "==", session.user.id).orderBy("updatedAt", "desc").get()

    const flows = userFlows.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    }))

    return NextResponse.json({ flows })
  } catch (error) {
    console.error("Error fetching flows:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, nodes, edges } = body

    if (!name || !nodes || !edges) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const firestore = getFirestore()
    const flowsRef = firestore.collection(COLLECTIONS.FLOWS)

    const flowData = {
      userId: session.user.id,
      name,
      nodes,
      edges,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const docRef = await flowsRef.add(flowData)

    return NextResponse.json({
      id: docRef.id,
      ...flowData,
      createdAt: flowData.createdAt.toISOString(),
      updatedAt: flowData.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error("Error creating flow:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

