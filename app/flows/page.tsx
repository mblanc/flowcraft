"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Plus, Trash2, Calendar, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserProfile } from "@/components/user-profile"
import Image from "next/image"

interface Flow {
  id: string
  name: string
  thumbnail?: string
  createdAt: string
  updatedAt: string
}

export default function FlowsList() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  

  const fetchFlows = useCallback(async () => {
    try {
      if (session) {
        const response = await fetch("/api/flows")
        if (response.ok) {
          const data = await response.json()
          setFlows(data.flows || [])
        }
      }
    } catch (error) {
      console.error("Error fetching flows:", error)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (status === "authenticated") {
      fetchFlows()
    }
  }, [status, fetchFlows])

  const handleCreateFlow = async () => {
    setCreating(true)
    try {
      const response = await fetch("/api/flows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "New Flow",
          nodes: [],
          edges: [],
        }),
      })

      if (response.ok) {
        const flow = await response.json()
        router.push(`/flow/${flow.id}`)
      }
    } catch (error) {
      console.error("Error creating flow:", error)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this flow?")) return

    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setFlows(flows.filter((f) => f.id !== flowId))
      }
    } catch (error) {
      console.error("Error deleting flow:", error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">F</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">FlowCraft</h1>
          </div>
        </div>
        <UserProfile isCollapsed={false} />
      </header>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Your Flows</h2>
              <p className="text-muted-foreground">Create and manage your AI workflows</p>
            </div>
            <Button onClick={handleCreateFlow} disabled={creating} size="lg">
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  New Flow
                </>
              )}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-lg">
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold text-foreground mb-2">No flows yet</h3>
                <p className="text-muted-foreground mb-6">Create your first flow to get started</p>
                <Button onClick={handleCreateFlow} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Flow
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  className="group relative border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-card"
                  onClick={() => router.push(`/flow/${flow.id}`)}
                >
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {flow.thumbnail ? (
                      <Image src={flow.thumbnail} alt={flow.name} width={300} height={200} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center mx-auto mb-2">
                          <span className="text-primary-foreground font-bold text-sm">F</span>
                        </div>
                        <p className="text-xs">No preview</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {flow.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(flow.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFlow(flow.id)
                    }}
                    className="absolute top-2 right-2 p-2 rounded-md bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

