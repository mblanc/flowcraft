import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { NodeTitle } from "../components/node-title";

describe("NodeTitle", () => {
    it("renders without crashing", () => {
        const { container } = render(
            <NodeTitle name="Test Node" onRename={vi.fn()} />,
        );
        expect(container).toBeDefined();
    });
});
