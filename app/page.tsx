"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/flows")
    } else if (status === "unauthenticated") {
      router.push("/sign-in")
    }
  }, [status, router])

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

