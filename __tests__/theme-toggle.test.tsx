import { render, screen } from "@testing-library/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { describe, it, expect } from "vitest";

describe("ThemeToggle", () => {
    it("renders without crashing", () => {
        render(
            <ThemeProvider attribute="class">
                <TooltipProvider>
                    <ThemeToggle />
                </TooltipProvider>
            </ThemeProvider>,
        );
        expect(
            screen.getByRole("button", { name: /toggle theme/i }),
        ).toBeDefined();
    });
});
