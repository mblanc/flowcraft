"use client"

import { FlowCanvas } from "@/components/flow-canvas"
import { FlowProvider } from "@/components/flow-provider"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"

export default function Home() {
  return (
    <FlowProvider>
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <FlowCanvas />
          <Sidebar />
        </div>
      </div>
    </FlowProvider>
  )
}
