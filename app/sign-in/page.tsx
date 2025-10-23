import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">Sign In</h1>
      <form
        action={async () => {
          "use server"
          await signIn("google")
        }}
      >
        <Button type="submit">Sign in with Google</Button>
      </form>
    </div>
  )
} 