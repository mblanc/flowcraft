import { render, screen } from "@testing-library/react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { describe, it, expect } from "vitest";

describe("ThemeToggle", () => {
    it("renders without crashing", () => {
        render(
            <ThemeProvider attribute="class">
                <ThemeToggle />
            </ThemeProvider>,
        );
        expect(
            screen.getByRole("button", { name: /toggle theme/i }),
        ).toBeDefined();
    });
});
