import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="bg-background flex h-screen overflow-hidden">
            <Sidebar />
            <main className="relative flex-1 overflow-x-hidden overflow-y-auto px-20 py-14">
                <div className="animate-in fade-in mx-auto max-w-5xl duration-300">
                    {children}
                </div>
            </main>
        </div>
    );
}
