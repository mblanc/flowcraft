/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Header } from "../components/flow/header";
import { TooltipProvider } from "../components/ui/tooltip";

vi.mock("next-auth/react", () => ({
    useSession: vi.fn(() => ({
        data: { user: { id: "user-1", name: "Test User", image: "" } },
    })),
    signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/",
}));

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: vi.fn((selector: any) =>
        selector({
            flowId: "flow-1",
            entityType: "workflow",
            nodes: [],
            edges: [],
            isSaving: false,
            isRunning: false,
            ownerId: "user-1",
            sharedWith: [],
        }),
    ),
}));

vi.mock("../hooks/use-flow-execution", () => ({
    useFlowExecution: () => ({
        runFlow: vi.fn(),
        stopExecution: vi.fn(),
    }),
}));

describe("Header Rendering", () => {
    it("should render without crashing", () => {
        const { container } = render(
            <TooltipProvider>
                <Header />
            </TooltipProvider>,
        );
        expect(container).toBeDefined();
    });
});
