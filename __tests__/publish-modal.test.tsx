import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PublishModal } from "../components/publish-modal";
import { vi, describe, it, expect } from "vitest";

// Mock fetch
global.fetch = vi.fn();

// Mock sonner
vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("PublishModal", () => {
    it("should render trigger button", () => {
        render(<PublishModal flowId="1" />);
        expect(screen.getByText("Publish")).toBeInTheDocument();
    });

    it("should open dialog on click", async () => {
        render(<PublishModal flowId="1" />);
        const button = screen.getByText("Publish");
        fireEvent.click(button);
        
        await waitFor(() => {
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });
        
        expect(screen.getByText("Publish Workflow")).toBeInTheDocument();
    });

    it("should call publish API on confirm", async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ version: "1.0.1" }),
        } as any);

        render(<PublishModal flowId="1" />);
        fireEvent.click(screen.getByText("Publish"));
        
        await waitFor(() => {
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });

        const confirmButton = screen.getByText("Publish Now");
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("/api/flows/1/publish", expect.objectContaining({
                method: "POST"
            }));
        });
    });
});
