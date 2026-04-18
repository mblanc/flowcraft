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
        <aside className="border-sidebar-border bg-sidebar flex h-screen w-64 flex-col border-r backdrop-blur-xl">
            <div className="flex h-16 items-center px-6">
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/flowcraft_logo.png"
                        alt="FlowCraft"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-foreground text-lg font-semibold tracking-tight">
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
                                "group relative flex items-center gap-3 rounded-lg px-[14px] py-[10px] text-sm font-medium transition-all duration-150",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                            {isActive && (
                                <div className="bg-primary absolute left-0 h-6 w-[3px] rounded-r-full" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto space-y-1 border-t px-3 py-4">
                <Link
                    href="/settings"
                    className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-[14px] py-[10px] text-sm font-medium transition-all duration-150",
                        pathname === "/settings"
                            ? "bg-primary/10 text-primary"
                            : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
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
