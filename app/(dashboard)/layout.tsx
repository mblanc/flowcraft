import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="bg-background flex h-screen overflow-hidden">
            <Sidebar />
            <main className="relative flex-1 overflow-x-hidden overflow-y-auto p-8">
                <div className="animate-in fade-in mx-auto max-w-7xl duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
