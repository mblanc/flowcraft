"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { FlowCanvas } from "@/components/flow-canvas"
import { FlowProvider, useFlow } from "@/components/flow-provider"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"

function FlowCanvasContent() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { loadFlow } = useFlow()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Ref to track the currently loaded ID to prevent re-fetching on tab switch
  const loadedFlowId = useRef<string | null>(null)

  const fetchFlow = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/flows/${id}`)
      if (response.ok) {
        const flow = await response.json()
        loadFlow(id, flow.nodes, flow.edges, flow.name)
        setLoading(false)
      } else if (response.status === 404) {
        setNotFound(true)
        setLoading(false)
      } else {
        console.error("Error fetching flow")
        setLoading(false)
      }
    } catch (error) {
      console.error("Error fetching flow:", error)
      setLoading(false)
    }
  }, [loadFlow])

  useEffect(() => {
    const id = params.id as string

    // Only fetch if session exists, ID exists, AND we haven't loaded this ID yet
    if (session && id && loadedFlowId.current !== id) {
      loadedFlowId.current = id // Mark this ID as loaded
      fetchFlow(id)
    }
  }, [session, params.id, fetchFlow])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Flow not found</h2>
          <p className="text-muted-foreground mb-4">This flow doesn&apos;t exist or you don&apos;t have permission to access it.</p>
          <button
            onClick={() => router.push("/flows")}
            className="text-primary hover:underline"
          >
            Back to flows
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <FlowCanvas />
        <Sidebar />
      </div>
    </div>
  )
}

export default function FlowPage() {
  return (
    <FlowProvider>
      <FlowCanvasContent />
    </FlowProvider>
  )
}

