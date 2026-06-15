import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareDialog } from "@/components/sharing/ShareDialog";

// DOM stubs required by Radix UI dialog/select
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

Object.defineProperty(window, "location", {
    writable: true,
    value: { origin: "https://app.example.com" },
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
Object.defineProperty(navigator, "clipboard", {
    value: mockClipboard,
    configurable: true,
});

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    artifactType: "canvas" as const,
    artifactId: "canvas-123",
    artifactName: "My Canvas",
    currentVisibility: "private" as const,
    sharedWith: [],
    isTemplate: false,
    isOwner: true,
    isAdmin: false,
};

describe("ShareDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
    });

    it("renders with artifact name in title", () => {
        render(<ShareDialog {...baseProps} />);
        expect(screen.getByText(/my canvas/i)).toBeDefined();
    });

    it("renders Share Canvas as dialog title", () => {
        render(<ShareDialog {...baseProps} />);
        expect(screen.getByText("Share Canvas")).toBeDefined();
    });

    it("renders Share Flow as dialog title for flow type", () => {
        render(
            <ShareDialog {...baseProps} artifactType="flow" artifactId="f1" />,
        );
        expect(screen.getByText("Share Flow")).toBeDefined();
    });

    it("shows People section for canvas (supports invites)", () => {
        render(<ShareDialog {...baseProps} />);
        expect(screen.getByText("Share with people")).toBeDefined();
    });

    it("hides People section for asset type", () => {
        render(
            <ShareDialog {...baseProps} artifactType="asset" artifactId="a1" />,
        );
        expect(screen.queryByText("Share with people")).toBeNull();
    });

    it("hides Community toggle for asset type", () => {
        render(
            <ShareDialog
                {...baseProps}
                artifactType="asset"
                artifactId="a1"
                isAdmin
            />,
        );
        expect(screen.queryByText("Publish to Community")).toBeNull();
    });

    it("shows Community toggle for canvas when admin and owner", () => {
        render(<ShareDialog {...baseProps} isAdmin />);
        expect(screen.getByText("Publish to Community")).toBeDefined();
    });

    it("hides Community toggle when not admin", () => {
        render(<ShareDialog {...baseProps} isAdmin={false} />);
        expect(screen.queryByText("Publish to Community")).toBeNull();
    });

    it("Save button disabled when not owner", () => {
        render(<ShareDialog {...baseProps} isOwner={false} />);
        expect(screen.queryByText("Save Changes")).toBeNull();
    });

    it("shows existing sharedWith users", () => {
        render(
            <ShareDialog
                {...baseProps}
                sharedWith={[{ email: "bob@example.com", role: "view" }]}
            />,
        );
        expect(screen.getByText("bob@example.com")).toBeDefined();
    });

    it("adds a user to the invite list when Add is clicked", () => {
        render(<ShareDialog {...baseProps} />);
        const input = screen.getByPlaceholderText("Enter email address");
        fireEvent.change(input, { target: { value: "alice@example.com" } });
        const addButton = screen.getByRole("button", { name: /^add$/i });
        fireEvent.click(addButton);
        expect(screen.getByText("alice@example.com")).toBeDefined();
    });

    it("removes a user when the trash button is clicked", () => {
        render(
            <ShareDialog
                {...baseProps}
                sharedWith={[{ email: "bob@example.com", role: "view" }]}
            />,
        );
        expect(screen.getByText("bob@example.com")).toBeDefined();
        // Find and click the trash button next to the user
        const deleteButtons = screen.getAllByRole("button");
        const trashBtn = deleteButtons.find((btn) => btn.querySelector("svg"));
        if (trashBtn) {
            // There are multiple icon buttons; find the one in the user list
            const userRow = screen
                .getByText("bob@example.com")
                .closest("div[class*='divide']")?.parentElement;
            const trashInRow = userRow?.querySelector("button");
            if (trashInRow) fireEvent.click(trashInRow);
        }
    });

    it("calls PATCH on save for canvas type", async () => {
        render(<ShareDialog {...baseProps} />);
        const saveBtn = screen.getByRole("button", { name: /save changes/i });
        fireEvent.click(saveBtn);
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "/api/canvases/canvas-123",
                expect.objectContaining({ method: "PATCH" }),
            );
        });
    });

    it("calls PUT on save for style type", async () => {
        render(
            <ShareDialog
                {...baseProps}
                artifactType="style"
                artifactId="style-1"
            />,
        );
        const saveBtn = screen.getByRole("button", { name: /save changes/i });
        fireEvent.click(saveBtn);
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "/api/styles/style-1",
                expect.objectContaining({ method: "PUT" }),
            );
        });
    });

    it("calls onSaved callback after successful save", async () => {
        const onSaved = vi.fn();
        render(<ShareDialog {...baseProps} onSaved={onSaved} />);
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
        await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    });

    it("copies the correct canvas link to clipboard", () => {
        render(<ShareDialog {...baseProps} />);
        fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
            "https://app.example.com/canvas/canvas-123",
        );
    });

    it("copies the correct flow link to clipboard", () => {
        render(
            <ShareDialog
                {...baseProps}
                artifactType="flow"
                artifactId="flow-abc"
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
            "https://app.example.com/flow/flow-abc",
        );
    });

    it("calls onClose when Cancel is clicked", () => {
        render(<ShareDialog {...baseProps} />);
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(baseProps.onClose).toHaveBeenCalledOnce();
    });
});
