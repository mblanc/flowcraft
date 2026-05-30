/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ConfigPanel } from "../components/panels/config-panel";

vi.mock("../lib/store/use-flow-store", () => ({
    useFlowStore: vi.fn((selector: any) =>
        selector({
            nodes: [{ id: "1", data: { name: "Test Node", type: "text" } }],
            edges: [],
            updateNodeData: vi.fn(),
            selectedNode: {
                id: "1",
                data: { name: "Test Node", type: "text" },
            },
            isConfigSidebarOpen: true,
            setIsConfigSidebarOpen: vi.fn(),
        }),
    ),
}));

describe("ConfigPanel Rendering", () => {
    it("should render without crashing", () => {
        const { container } = render(<ConfigPanel />);
        expect(container).toBeDefined();
    });
});
