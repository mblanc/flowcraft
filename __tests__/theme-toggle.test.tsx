import { render, screen } from "@testing-library/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { describe, it, expect } from "vitest";

describe("ThemeToggle", () => {
    it("renders without crashing", () => {
        render(
            <TooltipProvider>
                <ThemeProvider attribute="class">
                    <ThemeToggle />
                </ThemeProvider>
            </TooltipProvider>,
        );
        expect(
            screen.getByRole("button", { name: /toggle theme/i }),
        ).toBeDefined();
    });
});
