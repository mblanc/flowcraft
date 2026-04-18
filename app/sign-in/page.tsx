import Image from "next/image";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
    return (
        <div className="bg-background flex h-screen flex-col items-center justify-center">
            <div className="flex w-full max-w-sm flex-col items-center gap-10">
                {/* Wordmark */}
                <div className="flex items-center gap-2.5">
                    <Image
                        src="/flowcraft_logo.png"
                        alt="FlowCraft"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-foreground text-xl font-semibold tracking-tight">
                        FlowCraft
                    </span>
                </div>

                {/* Heading */}
                <div className="space-y-2 text-center">
                    <h1
                        className="text-foreground text-3xl font-bold"
                        style={{ letterSpacing: "-0.02em" }}
                    >
                        Sign in
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Build, create, and manage your AI workflows in one
                        place.
                    </p>
                </div>

                {/* Auth */}
                <form
                    action={async () => {
                        "use server";
                        await signIn("google");
                    }}
                    className="w-full"
                >
                    <Button type="submit" className="w-full rounded-md">
                        Sign in with Google
                    </Button>
                </form>
            </div>

            {/* Footer */}
            <p className="text-muted-foreground absolute bottom-8 text-xs">
                AI workflow builder
            </p>
        </div>
    );
}
