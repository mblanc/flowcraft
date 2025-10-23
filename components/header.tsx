"use client"

import { Button } from "@/components/ui/button"
import { Download, Upload } from "lucide-react"
import { useFlow } from "@/components/flow-provider"
import { UserProfile } from "./user-profile"

export function Header() {
  const { exportFlow, importFlow } = useFlow()

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">F</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">FlowCraft</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={importFlow}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="ghost" size="sm" onClick={exportFlow}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <UserProfile isCollapsed={false} />
      </div>
    </header>
  )
}
