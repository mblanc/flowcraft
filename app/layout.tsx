import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Suspense } from "react";

import "./globals.css";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";

export const metadata: Metadata = {
    title: "FlowCraft",
    description:
        "A visual workflow builder for AI-powered content generation using Google's AI models",
    icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`font-sans ${GeistSans.variable}`}>
                <NextAuthSessionProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <Suspense fallback={null}>{children}</Suspense>
                        <Toaster richColors closeButton />
                    </ThemeProvider>
                </NextAuthSessionProvider>
            </body>
        </html>
    );
}
