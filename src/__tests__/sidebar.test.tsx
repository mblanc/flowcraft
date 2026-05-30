/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Sidebar } from "../components/flow/sidebar";
import { TooltipProvider } from "../components/ui/tooltip";

vi.mock("next-auth/react", () => ({
    useSession: vi.fn(() => ({ data: { user: { id: "user-1" } } })),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/flow/flow-1",
}));

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: vi.fn((selector: any) =>
        selector({
            addNodeWithType: vi.fn(),
        }),
    ),
}));

describe("Sidebar Rendering", () => {
    it("should render without crashing", () => {
        const { container } = render(
            <TooltipProvider>
                <Sidebar />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
    });
});
