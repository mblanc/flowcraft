"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Upload, ArrowLeft, Save } from "lucide-react"
import { useFlow } from "@/components/flow-provider"
import { UserProfile } from "./user-profile"

export function Header() {
  const { exportFlow, importFlow, flowId, flowName, updateFlowName, saveFlow } = useFlow()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(flowName)

  useEffect(() => {
    setEditedName(flowName)
  }, [flowName])

  const handleSaveName = async () => {
    updateFlowName(editedName)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedName(flowName)
    setIsEditing(false)
  }

  // New handler function to Save then Navigate
  const handleBack = async () => {
    await saveFlow() // Wait for the save operation to finish
    router.push("/flows")
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        {flowId && (
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">F</span>
          </div>
          {flowId ? (
            isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName()
                    if (e.key === "Escape") handleCancelEdit()
                  }}
                  className="h-8 w-48"
                  autoFocus
                />
                <Button variant="ghost" size="sm" onClick={handleSaveName}>
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h1
                className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => setIsEditing(true)}
              >
                {flowName}
              </h1>
            )
          ) : (
            <h1 className="text-lg font-semibold text-foreground">FlowCraft</h1>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {flowId && (
          <Button variant="ghost" size="sm" onClick={() => saveFlow()}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={importFlow}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        {flowId && (
          <Button variant="ghost" size="sm" onClick={exportFlow}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
        <UserProfile isCollapsed={false} />
      </div>
    </header>
  )
}

