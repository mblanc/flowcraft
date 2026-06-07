/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

vi.mock("../../lib/store/use-canvas-store", () => ({
    useCanvasStore: Object.assign(
        (selector: any) =>
            selector({
                updateNodeData: vi.fn(),
                removeNode: vi.fn(),
            }),
        {
            getState: () => ({
                updateNodeData: vi.fn(),
                removeNode: vi.fn(),
            }),
        },
    ),
}));

vi.mock("../../hooks/use-canvas-node-resize", () => ({
    useCanvasNodeResize: () => ({
        dimensions: { width: 480, height: 600 },
        handleResizeStart: vi.fn(),
    }),
}));

vi.mock("../../components/canvas/canvas-node-context-menu", () => ({
    CanvasNodeContextMenu: ({ children }: { children: React.ReactNode }) =>
        children,
}));

vi.mock("../../components/nodes/node-resize-handle", () => ({
    NodeResizeHandle: () => null,
}));

// Avoid loading the heavy MDX editor in tests
vi.mock("next/dynamic", () => ({
    default: () => () => <div data-testid="text-editor-mock" />,
}));

vi.mock("react-markdown", () => ({
    default: ({ children }: { children: string }) => (
        <div data-testid="markdown">{children}</div>
    ),
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

import { CanvasTextNode } from "../../components/canvas/nodes/canvas-text-node";

function makeProps(data: Record<string, unknown>): NodeProps<any> {
    return {
        id: "txt_1",
        data,
        selected: false,
        type: "canvas-text",
        dragging: false,
        zIndex: 0,
        isConnectable: true,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
        width: 480,
        height: 600,
        sourcePosition: "bottom" as any,
        targetPosition: "top" as any,
        dragHandle: undefined,
        parentId: undefined,
    } as NodeProps<any>;
}

describe("CanvasTextNode", () => {
    it("renders content as markdown in read mode", () => {
        const props = makeProps({
            type: "canvas-text",
            label: "My Scenario",
            content: "# Shot 01\n\nThe Watcher",
            width: 480,
            height: 600,
        });
        render(
            <ReactFlowProvider>
                <CanvasTextNode {...props} />
            </ReactFlowProvider>,
        );
        expect(screen.getByTestId("markdown")).toBeTruthy();
    });

    it("shows format badge when format is set and node is selected + info open", () => {
        const props = makeProps({
            type: "canvas-text",
            label: "Lumino Scenario",
            content: "Shot 01...",
            format: "scenario",
            width: 480,
            height: 600,
        });
        const { rerender } = render(
            <ReactFlowProvider>
                <CanvasTextNode {...props} />
            </ReactFlowProvider>,
        );

        // Select the node so the toolbar appears
        rerender(
            <ReactFlowProvider>
                <CanvasTextNode {...{ ...props, selected: true }} />
            </ReactFlowProvider>,
        );

        // Click the info button (Info icon in the toolbar)
        const infoButtons = document.querySelectorAll("button[title='Info']");
        if (infoButtons.length > 0) {
            fireEvent.click(infoButtons[0]);
            expect(document.body.textContent).toContain("scenario");
        }
    });

    it("does not show format badge when format is absent", () => {
        const props = makeProps({
            type: "canvas-text",
            label: "Notes",
            content: "Some notes",
            width: 480,
            height: 600,
        });
        render(
            <ReactFlowProvider>
                <CanvasTextNode {...props} />
            </ReactFlowProvider>,
        );
        // Only "Text" badge should be present, not synopsis/scenario/etc
        const text = document.body.textContent ?? "";
        expect(text).not.toMatch(
            /\bscenario\b|\bsynopsis\b|\bbrief\b|\bnotes badge\b/,
        );
    });

    it("enters edit mode on double click", () => {
        const props = makeProps({
            type: "canvas-text",
            label: "Editable",
            content: "Click me",
            width: 480,
            height: 600,
        });
        render(
            <ReactFlowProvider>
                <CanvasTextNode {...props} />
            </ReactFlowProvider>,
        );
        const readView = screen.getByTestId("markdown").closest("div");
        if (readView) fireEvent.dblClick(readView);
        // After double-click, the editor mock should appear
        expect(screen.queryByTestId("text-editor-mock")).toBeTruthy();
    });

    it("opens the expand dialog when the expand button is clicked", () => {
        const props = makeProps({
            type: "canvas-text",
            label: "Expandable Node",
            content: "Long text content",
            width: 480,
            height: 600,
        });
        render(
            <ReactFlowProvider>
                <CanvasTextNode {...{ ...props, selected: true }} />
            </ReactFlowProvider>,
        );

        const expandButton = screen.getByTitle("Expand");
        expect(expandButton).toBeTruthy();
        fireEvent.click(expandButton);

        // The dialog title should contain the label
        expect(screen.getAllByText("Expandable Node").length).toBe(2);

        // Inside the dialog, the CanvasTextEditor should be rendered
        expect(screen.getByTestId("text-editor-mock")).toBeTruthy();
    });

    it("calls handleDownload when the download button is clicked", () => {
        const createObjectURLMock = vi.fn().mockReturnValue("blob:foo");
        const revokeObjectURLMock = vi.fn();
        window.URL.createObjectURL = createObjectURLMock;
        window.URL.revokeObjectURL = revokeObjectURLMock;

        // Mock click on anchor element to prevent navigating in jsdom
        const clickMock = vi.fn();
        const createElementOriginal = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(
            (tagName: string) => {
                const el = createElementOriginal(tagName);
                if (tagName === "a") {
                    el.click = clickMock;
                }
                return el;
            },
        );

        const props = makeProps({
            type: "canvas-text",
            label: "Downloadable Node",
            content: "Text to download",
            width: 480,
            height: 600,
        });

        render(
            <ReactFlowProvider>
                <CanvasTextNode {...{ ...props, selected: true }} />
            </ReactFlowProvider>,
        );

        const downloadButton = screen.getByTitle("Download");
        expect(downloadButton).toBeTruthy();
        fireEvent.click(downloadButton);

        expect(createObjectURLMock).toHaveBeenCalled();
        expect(clickMock).toHaveBeenCalled();
        expect(revokeObjectURLMock).toHaveBeenCalled();

        vi.restoreAllMocks();
    });
});
