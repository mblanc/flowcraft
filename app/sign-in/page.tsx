import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
    return (
        <div className="flex h-screen flex-col items-center justify-center">
            <h1 className="mb-4 text-2xl font-bold">Sign In</h1>
            <form
                action={async () => {
                    "use server";
                    await signIn("google");
                }}
            >
                <Button type="submit">Sign in with Google</Button>
            </form>
        </div>
    );
}
