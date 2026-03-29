import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { describe, it, expect } from "vitest";

describe("ThemeProvider", () => {
    it("renders children correctly", () => {
        render(
            <ThemeProvider attribute="class">
                <div data-testid="test-child">Child</div>
            </ThemeProvider>,
        );
        expect(screen.getByTestId("test-child")).toBeDefined();
    });
});
