"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Workflow,
    Bot,
    Globe,
    Users,
    BookImage,
    Plus,
    ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const dashboardBoxes = [
    {
        name: "Flows",
        description: "Visual workflow builder for AI content generation",
        href: "/flows",
        icon: Workflow,
        accent: true,
    },
    {
        name: "Agents",
        description: "Collaborative canvas for agent-driven media",
        href: "/agents",
        icon: Bot,
        accent: false,
    },
    {
        name: "Community",
        description: "Discover and share workflow templates",
        href: "/community",
        icon: Globe,
        accent: false,
    },
    {
        name: "Shared with me",
        description: "Access workflows shared by your team",
        href: "/shared",
        icon: Users,
        accent: false,
    },
    {
        name: "Library",
        description: "Manage your generated assets and media",
        href: "/library",
        icon: BookImage,
        accent: false,
    },
];

export default function HomePage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    if (status === "loading") {
        return null;
    }

    if (status === "unauthenticated") {
        router.push("/sign-in");
        return null;
    }

    return (
        <div className="space-y-16">
            <header className="space-y-2">
                <h1
                    className="text-foreground text-4xl font-bold sm:text-5xl"
                    style={{ letterSpacing: "-0.02em" }}
                >
                    Welcome back, {session?.user?.name?.split(" ")[0]}.
                </h1>
                <p className="text-muted-foreground max-w-xl text-base">
                    Build, create, and manage your AI workflows in one place.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {dashboardBoxes.map((box) => (
                    <div
                        key={box.name}
                        onClick={() => router.push(box.href)}
                        className={cn(
                            "group relative flex cursor-pointer flex-col rounded-lg border p-5 transition-shadow duration-150 hover:shadow-sm",
                            box.accent
                                ? "border-primary/40 bg-card"
                                : "border-border bg-card",
                        )}
                        style={{ minHeight: 160 }}
                    >
                        <div
                            className={cn(
                                "mb-auto flex h-9 w-9 items-center justify-center rounded-md transition-transform duration-150 group-hover:rotate-6",
                                box.accent ? "bg-primary/10" : "bg-muted",
                            )}
                        >
                            <box.icon
                                className={cn(
                                    "h-5 w-5",
                                    box.accent
                                        ? "text-primary"
                                        : "text-muted-foreground",
                                )}
                            />
                        </div>

                        <div className="mt-8 space-y-1">
                            <h2
                                className={cn(
                                    "text-sm font-semibold",
                                    box.accent
                                        ? "text-primary"
                                        : "text-foreground",
                                )}
                            >
                                {box.name}
                            </h2>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                {box.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2
                        className="text-foreground text-base font-semibold"
                        style={{ letterSpacing: "-0.01em" }}
                    >
                        Recent flows
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:bg-primary/5 gap-1 text-xs"
                        onClick={() => router.push("/flows")}
                    >
                        View all <ArrowRight className="h-3 w-3" />
                    </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div
                        onClick={() => router.push("/flows")}
                        className="border-border hover:border-primary/40 flex h-32 cursor-pointer flex-col items-start justify-between rounded-lg border border-dashed p-5 transition-colors duration-150"
                    >
                        <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-md">
                            <Plus className="text-primary h-4 w-4" />
                        </div>
                        <p className="text-foreground text-sm font-medium">
                            Create a new flow
                        </p>
                    </div>
                    <div
                        onClick={() => router.push("/agents")}
                        className="border-border hover:border-primary/40 flex h-32 cursor-pointer flex-col items-start justify-between rounded-lg border border-dashed p-5 transition-colors duration-150"
                    >
                        <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-md">
                            <Bot className="text-muted-foreground h-4 w-4" />
                        </div>
                        <p className="text-foreground text-sm font-medium">
                            Start a new agent session
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
