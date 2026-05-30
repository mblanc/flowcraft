import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

import { SchemaEditor } from "../components/panels/schema-editor";
import { BatchMediaGallery } from "../components/nodes/batch-media-gallery";
import { ShareFlowModal } from "../components/flow/share-flow-modal";

// Mock resize observer and match media which might be used by Dialogs
class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.ResizeObserver = ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

describe("UI Components Rendering", () => {
    it("renders SchemaEditor without crashing", () => {
        const { container } = render(
            <SchemaEditor
                visualSchema={[
                    {
                        name: "test_field",
                        type: "string",
                        description: "A simple string",
                        required: true,
                    },
                    { name: "test_num", type: "number", required: true },
                    { name: "test_arr", type: "array", required: true },
                ]}
                onChange={vi.fn()}
            />,
        );
        expect(container).toBeDefined();
    });

    it("renders BatchMediaGallery without crashing", () => {
        const { container } = render(
            <BatchMediaGallery
                items={[
                    "http://example.com/test.jpg",
                    "http://example.com/test2.jpg",
                ]}
                type="image"
                maxHeight={100}
                nodeWidth={200}
            />,
        );
        expect(container).toBeDefined();
    });

    it("renders ShareFlowModal for Owner", () => {
        const { baseElement } = render(
            <ShareFlowModal
                isOpen={true}
                onClose={vi.fn()}
                flowId="123"
                flowName="Test Flow"
                isOwner={true}
                isAdmin={true}
                initialSharedWith={[
                    { email: "test@example.com", role: "view" },
                ]}
            />,
        );
        expect(baseElement).toBeDefined();
    });

    it("renders ShareFlowModal for Non-Owner", () => {
        const { baseElement } = render(
            <ShareFlowModal
                isOpen={true}
                onClose={vi.fn()}
                flowId="123"
                flowName="Test Flow"
                isOwner={false}
                initialVisibility="public"
                initialSharedWith={[
                    { email: "test2@example.com", role: "edit" },
                ]}
            />,
        );
        expect(baseElement).toBeDefined();
    });
});
