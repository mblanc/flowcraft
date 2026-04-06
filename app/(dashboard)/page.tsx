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
        name: "FlowCraft",
        description: "Visual workflow builder for AI content generation",
        href: "/flows",
        icon: Workflow,
        color: "from-blue-500 to-indigo-600",
        shadow: "shadow-blue-500/20",
    },
    {
        name: "Agents (Canvas)",
        description: "Collaborative canvas for agent-driven media Creation",
        href: "/agents",
        icon: Bot,
        color: "from-purple-500 to-pink-600",
        shadow: "shadow-purple-500/20",
    },
    {
        name: "Community",
        description: "Discover and share workflow templates",
        href: "/community",
        icon: Globe,
        color: "from-emerald-500 to-teal-600",
        shadow: "shadow-emerald-500/20",
    },
    {
        name: "Shared with Me",
        description: "Access workflows shared by your team",
        href: "/shared",
        icon: Users,
        color: "from-amber-500 to-orange-600",
        shadow: "shadow-amber-500/20",
    },
    {
        name: "Library",
        description: "Manage your generated assets and media",
        href: "/library",
        icon: BookImage,
        color: "from-slate-700 to-slate-900",
        shadow: "shadow-slate-500/20",
    },
];

export default function HomePage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    if (status === "loading") {
        return null; // Layout handles the skeleton if needed, or just let it load
    }

    if (status === "unauthenticated") {
        router.push("/sign-in");
        return null;
    }

    return (
        <div className="space-y-12">
            <header className="space-y-4">
                <h1 className="text-foreground text-4xl font-extrabold tracking-tight sm:text-5xl">
                    Welcome back,{" "}
                    <span className="text-primary italic">
                        {session?.user?.name?.split(" ")[0]}
                    </span>
                </h1>
                <p className="text-muted-foreground max-w-2xl text-lg">
                    Build, create, and manage your AI workflows in one place.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {dashboardBoxes.map((box) => (
                    <div
                        key={box.name}
                        onClick={() => router.push(box.href)}
                        className={cn(
                            "group border-border/50 bg-card relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl",
                            box.shadow,
                        )}
                    >
                        <div
                            className={cn(
                                "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br transition-all duration-300 group-hover:rotate-6",
                                box.color,
                            )}
                        >
                            <box.icon className="h-7 w-7 text-white" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-foreground text-xl font-bold tracking-tight">
                                {box.name}
                            </h2>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {box.description}
                            </p>
                        </div>

                        <div className="mt-8 flex items-center justify-between">
                            <div className="bg-muted group-hover:bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full transition-colors">
                                <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                        </div>

                        {/* Hover Gradient Glow */}
                        <div
                            className={cn(
                                "absolute -top-4 -right-4 -z-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-10",
                                box.color,
                            )}
                        />
                    </div>
                ))}
            </div>

            {/* Quick Actions / Recent Items Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-foreground text-2xl font-bold tracking-tight">
                        Recent Projects
                    </h2>
                    <Button
                        variant="ghost"
                        className="text-primary hover:bg-primary/5"
                        onClick={() => router.push("/flows")}
                    >
                        View All <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
                <div className="border-border grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="border-border/50 bg-muted/40 hover:bg-muted/60 flex h-48 flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-colors">
                        <div className="bg-primary/10 mb-4 rounded-full p-4">
                            <Plus className="text-primary h-8 w-8" />
                        </div>
                        <p className="text-muted-foreground font-medium">
                            Create a new Flow
                        </p>
                    </div>
                    <div className="border-border/50 bg-muted/40 hover:bg-muted/60 flex h-48 flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-colors">
                        <div className="mb-4 rounded-full bg-purple-500/10 p-4">
                            <Bot className="h-8 w-8 text-purple-500" />
                        </div>
                        <p className="text-muted-foreground font-medium">
                            Start a new Agent Session
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
