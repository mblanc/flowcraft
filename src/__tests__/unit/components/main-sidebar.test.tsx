import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";

let currentPathname = "/";

vi.mock("next/navigation", () => ({
    usePathname: () => currentPathname,
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/flow/user-profile", () => ({
    UserProfile: () => <div data-testid="user-profile" />,
}));

describe("Main Sidebar Navigation", () => {
    it("renders Home, Agents, Flows, and Library, but hides submenus when on Home without hover", () => {
        currentPathname = "/";
        render(<Sidebar />);

        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Agents")).toBeInTheDocument();
        expect(screen.getByText("Flows")).toBeInTheDocument();
        expect(screen.getByText("Library")).toBeInTheDocument();

        expect(screen.queryByText("Styles")).not.toBeInTheDocument();
        expect(screen.queryByText("Skills")).not.toBeInTheDocument();
        expect(screen.queryByText("Rulesets")).not.toBeInTheDocument();
    });

    it("displays submenus when hovering over Agents", () => {
        currentPathname = "/";
        render(<Sidebar />);

        const agentsParent = screen.getByText("Agents").closest(".space-y-1");
        expect(agentsParent).not.toBeNull();

        fireEvent.mouseEnter(agentsParent!);
        expect(screen.getByText("Styles")).toBeInTheDocument();
        expect(screen.getByText("Skills")).toBeInTheDocument();
        expect(screen.getByText("Rulesets")).toBeInTheDocument();

        fireEvent.mouseLeave(agentsParent!);
        expect(screen.queryByText("Styles")).not.toBeInTheDocument();
        expect(screen.queryByText("Skills")).not.toBeInTheDocument();
        expect(screen.queryByText("Rulesets")).not.toBeInTheDocument();
    });

    it("displays submenus when Agents route is active", () => {
        currentPathname = "/agents";
        render(<Sidebar />);

        expect(screen.getByText("Styles")).toBeInTheDocument();
        expect(screen.getByText("Skills")).toBeInTheDocument();
        expect(screen.getByText("Rulesets")).toBeInTheDocument();
    });

    it("displays submenus and highlights item when a subroute like /styles is active", () => {
        currentPathname = "/styles";
        render(<Sidebar />);

        expect(screen.getByText("Styles")).toBeInTheDocument();
        expect(screen.getByText("Skills")).toBeInTheDocument();
        expect(screen.getByText("Rulesets")).toBeInTheDocument();
    });
});
