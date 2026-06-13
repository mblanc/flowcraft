import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeParamsBar } from "@/components/nodes/node-params-bar";
import { NodeActionBar } from "@/components/nodes/node-action-bar";
import { TooltipProvider } from "@/components/ui/tooltip";

// Controls how many nodes are selected in the xyflow store
let mockSelectedCount = 0;

vi.mock("@xyflow/react", () => ({
    NodeToolbar: ({
        isVisible,
        children,
    }: {
        isVisible?: boolean;
        children: React.ReactNode;
    }) => (isVisible ? <div data-testid="toolbar">{children}</div> : null),
    Position: { Top: "top", Bottom: "bottom" },
    useStore: (selector: (s: { nodes: { selected: boolean }[] }) => unknown) =>
        selector({
            nodes: Array.from({ length: mockSelectedCount }, () => ({
                selected: true,
            })),
        }),
}));

// ── NodeParamsBar ──────────────────────────────────────────────────────────────

describe("NodeParamsBar", () => {
    it("renders children when visible and one node is selected", () => {
        mockSelectedCount = 1;
        render(
            <NodeParamsBar isVisible={true}>
                <span>params content</span>
            </NodeParamsBar>,
        );
        expect(screen.getByText("params content")).toBeDefined();
    });

    it("hides when isVisible is false", () => {
        mockSelectedCount = 1;
        render(
            <NodeParamsBar isVisible={false}>
                <span>hidden content</span>
            </NodeParamsBar>,
        );
        expect(screen.queryByText("hidden content")).toBeNull();
    });

    it("hides when multiple nodes are selected, even if isVisible is true", () => {
        mockSelectedCount = 2;
        render(
            <NodeParamsBar isVisible={true}>
                <span>multi-select hidden</span>
            </NodeParamsBar>,
        );
        expect(screen.queryByText("multi-select hidden")).toBeNull();
    });

    it("wraps children in a container with consistent background styling", () => {
        mockSelectedCount = 1;
        const { container } = render(
            <NodeParamsBar isVisible={true}>
                <span>styled content</span>
            </NodeParamsBar>,
        );
        const wrapper = container.querySelector(
            "[data-testid='params-bar-container']",
        );
        expect(wrapper?.className).toContain("bg-background/95");
        expect(wrapper?.className).toContain("backdrop-blur-md");
    });
});

// ── NodeActionBar ──────────────────────────────────────────────────────────────

function renderActionBar(props: Parameters<typeof NodeActionBar>[0]) {
    return render(
        <TooltipProvider>
            <NodeActionBar {...props} />
        </TooltipProvider>,
    );
}

describe("NodeActionBar", () => {
    beforeEach(() => {
        mockSelectedCount = 1;
    });

    it("renders generate button when onGenerate is provided", () => {
        renderActionBar({ onGenerate: vi.fn(), isVisible: true });
        // Play icon button should be in the toolbar
        expect(screen.getByTestId("toolbar")).toBeDefined();
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
    });

    it("calls onGenerate when generate button is clicked", () => {
        const onGenerate = vi.fn();
        renderActionBar({ onGenerate, isVisible: true });
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[0]);
        expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it("renders delete button when onDelete is provided", () => {
        const onDelete = vi.fn();
        renderActionBar({ onDelete, isVisible: true });
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBe(1);
        fireEvent.click(buttons[0]);
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("renders a divider between action buttons and delete when both are present", () => {
        const { container } = renderActionBar({
            onGenerate: vi.fn(),
            onDelete: vi.fn(),
            isVisible: true,
        });
        // The divider is a px-wide element separating the groups
        const divider = container.querySelector(".bg-border.w-px");
        expect(divider).not.toBeNull();
    });

    it("renders no divider when only delete is present", () => {
        const { container } = renderActionBar({
            onDelete: vi.fn(),
            isVisible: true,
        });
        const divider = container.querySelector(".bg-border.w-px");
        expect(divider).toBeNull();
    });

    it("hides when multiple nodes are selected", () => {
        mockSelectedCount = 2;
        renderActionBar({ onGenerate: vi.fn(), isVisible: true });
        expect(screen.queryByTestId("toolbar")).toBeNull();
    });

    it("renders loader when isExecuting is true", () => {
        const { container } = renderActionBar({
            onGenerate: vi.fn(),
            isVisible: true,
            isExecuting: true,
        });
        // Loader2 renders with animate-spin
        expect(container.querySelector(".animate-spin")).not.toBeNull();
    });

    it("renders batch progress when isExecuting with batchTotal", () => {
        renderActionBar({
            onGenerate: vi.fn(),
            isVisible: true,
            isExecuting: true,
            batchProgress: 2,
            batchTotal: 5,
        });
        expect(screen.getByText("2/5")).toBeDefined();
    });

    it("renders run-to-here button when onRunToHere is provided", () => {
        renderActionBar({ onRunToHere: vi.fn(), isVisible: true });
        expect(screen.getByTestId("toolbar")).toBeDefined();
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
    });

    it("calls onRunToHere when run-to-here button is clicked", () => {
        const onRunToHere = vi.fn();
        renderActionBar({ onRunToHere, isVisible: true });
        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(onRunToHere).toHaveBeenCalledTimes(1);
    });

    it("renders run-from-here button when onRunFromHere is provided", () => {
        renderActionBar({ onRunFromHere: vi.fn(), isVisible: true });
        expect(screen.getByTestId("toolbar")).toBeDefined();
    });

    it("calls onRunFromHere when run-from-here button is clicked", () => {
        const onRunFromHere = vi.fn();
        renderActionBar({ onRunFromHere, isVisible: true });
        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(onRunFromHere).toHaveBeenCalledTimes(1);
    });
});
