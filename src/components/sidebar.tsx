"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    Home,
    Bot,
    Palette,
    Workflow,
    BookImage,
    Settings,
    Sparkles,
    ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/components/flow/user-profile";

interface SubMenuItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    children?: SubMenuItem[];
}

const sidebarItems: NavItem[] = [
    { name: "Home", href: "/", icon: Home },
    {
        name: "Agents",
        href: "/agents",
        icon: Bot,
        children: [
            { name: "Styles", href: "/styles", icon: Palette },
            { name: "Skills", href: "/skills", icon: Sparkles },
            { name: "Rulesets", href: "/rulesets", icon: ShieldCheck },
        ],
    },
    { name: "Flows", href: "/flows", icon: Workflow },
    { name: "Library", href: "/library", icon: BookImage },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isAgentsHovered, setIsAgentsHovered] = useState(false);

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
                    const isExactActive = pathname === item.href;
                    const isChildActive =
                        item.children?.some(
                            (child) =>
                                pathname === child.href ||
                                pathname?.startsWith(child.href + "/"),
                        ) ?? false;
                    const isParentSelected = isExactActive || isChildActive;

                    if (item.children) {
                        const showSubMenu = isParentSelected || isAgentsHovered;

                        return (
                            <div
                                key={item.name}
                                className="space-y-1"
                                onMouseEnter={() => setIsAgentsHovered(true)}
                                onMouseLeave={() => setIsAgentsHovered(false)}
                            >
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "group relative flex items-center gap-3 rounded-lg px-[14px] py-[10px] text-sm font-medium transition-all duration-150",
                                        isExactActive
                                            ? "bg-primary/10 text-primary"
                                            : isChildActive
                                              ? "text-foreground font-semibold"
                                              : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.name}
                                    {isExactActive && (
                                        <div className="bg-primary absolute left-0 h-6 w-[3px] rounded-r-full" />
                                    )}
                                </Link>

                                {showSubMenu && (
                                    <div className="space-y-1 pt-0.5 pl-4">
                                        {item.children.map((child) => {
                                            const isChildItemActive =
                                                pathname === child.href ||
                                                pathname?.startsWith(
                                                    child.href + "/",
                                                );

                                            return (
                                                <Link
                                                    key={child.name}
                                                    href={child.href}
                                                    className={cn(
                                                        "group relative flex items-center gap-3 rounded-lg px-[14px] py-[8px] text-sm font-medium transition-all duration-150",
                                                        isChildItemActive
                                                            ? "bg-primary/10 text-primary"
                                                            : "text-sidebar-foreground/80 hover:bg-accent hover:text-foreground",
                                                    )}
                                                >
                                                    <child.icon className="h-4 w-4" />
                                                    {child.name}
                                                    {isChildItemActive && (
                                                        <div className="bg-primary absolute left-0 h-5 w-[3px] rounded-r-full" />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group relative flex items-center gap-3 rounded-lg px-[14px] py-[10px] text-sm font-medium transition-all duration-150",
                                isExactActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                            {isExactActive && (
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
