import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MentionEditor } from "../components/mention-editor";

describe("MentionEditor", () => {
    it("renders without crashing", () => {
        const { container } = render(
            <MentionEditor
                value="test @[1]"
                onChange={vi.fn()}
                availableNodes={[{ id: "1", name: "Node 1" }]}
            />,
        );
        expect(container).toBeDefined();
    });
});
