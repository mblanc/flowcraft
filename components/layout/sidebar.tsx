"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    Home,
    Workflow,
    Bot,
    Globe,
    Users,
    BookImage,
    Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/components/flow/user-profile";

const sidebarItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Flows", href: "/flows", icon: Workflow },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "Community", href: "/community", icon: Globe },
    { name: "Shared", href: "/shared", icon: Users },
    { name: "Library", href: "/library", icon: BookImage },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="border-border/50 bg-card/30 flex h-screen w-64 flex-col border-r backdrop-blur-xl">
            <div className="flex h-16 items-center px-6">
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/flowcraft_logo.png"
                        alt="FlowCraft"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-foreground text-lg font-bold tracking-tight">
                        FlowCraft
                    </span>
                </Link>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-5 w-5 transition-transform duration-200",
                                    isActive
                                        ? "scale-110"
                                        : "group-hover:scale-110",
                                )}
                            />
                            {item.name}
                            {isActive && (
                                <div className="bg-primary absolute left-0 h-6 w-1 rounded-r-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto space-y-1 border-t px-3 py-4">
                <Link
                    href="/settings"
                    className={cn(
                        "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out",
                        pathname === "/settings"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                >
                    <Settings className="h-5 w-5" />
                    Settings
                </Link>
                <div className="px-4 py-2">
                    <UserProfile isCollapsed={false} dropdownPosition="top" />
                </div>
            </div>
        </aside>
    );
}
