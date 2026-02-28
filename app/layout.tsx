import type React from "react";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const openSans = Open_Sans({
    weight: ["300", "400", "500", "600", "700"],
    subsets: ["latin"],
    variable: "--font-open-sans",
    display: "swap",
});

export const metadata: Metadata = {
    title: "FlowCraft",
    description:
        "A visual workflow builder for AI-powered content generation using Google's AI models",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`font-sans ${openSans.variable}`}>
                <NextAuthSessionProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <TooltipProvider>
                            <Suspense fallback={null}>{children}</Suspense>
                            <Toaster richColors closeButton />
                        </TooltipProvider>
                    </ThemeProvider>
                </NextAuthSessionProvider>
            </body>
        </html>
    );
}
