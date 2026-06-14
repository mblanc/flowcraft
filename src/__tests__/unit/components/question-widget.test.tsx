import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionWidget } from "@/components/canvas/question-widget";
import type { QuestionPayload } from "@/lib/canvas/types";

const question: QuestionPayload = {
    id: "aspect_ratio",
    question: "What aspect ratio should I use?",
    options: [
        { id: "16:9", label: "16:9 — Landscape" },
        { id: "9:16", label: "9:16 — Portrait" },
        {
            id: "1:1",
            label: "1:1 — Square",
            description: "Equal width and height",
        },
    ],
};

describe("QuestionWidget", () => {
    it("renders the question text and all option labels", () => {
        render(
            <QuestionWidget
                question={question}
                onAnswer={vi.fn()}
                answered={false}
            />,
        );

        expect(
            screen.getByText("What aspect ratio should I use?"),
        ).toBeDefined();
        expect(screen.getByText("16:9 — Landscape")).toBeDefined();
        expect(screen.getByText("9:16 — Portrait")).toBeDefined();
        expect(screen.getByText("1:1 — Square")).toBeDefined();
    });

    it("calls onAnswer with the option label when an option is clicked", async () => {
        const onAnswer = vi.fn();
        render(
            <QuestionWidget
                question={question}
                onAnswer={onAnswer}
                answered={false}
            />,
        );

        await userEvent.click(screen.getByText("16:9 — Landscape"));

        expect(onAnswer).toHaveBeenCalledWith("16:9 — Landscape");
    });

    it("appends description to the answer when the option has one", async () => {
        const onAnswer = vi.fn();
        render(
            <QuestionWidget
                question={question}
                onAnswer={onAnswer}
                answered={false}
            />,
        );

        await userEvent.click(screen.getByText("1:1 — Square"));

        expect(onAnswer).toHaveBeenCalledWith(
            "1:1 — Square — Equal width and height",
        );
    });

    it("calls onAnswer with free-text when Enter is pressed", async () => {
        const onAnswer = vi.fn();
        render(
            <QuestionWidget
                question={question}
                onAnswer={onAnswer}
                answered={false}
            />,
        );

        const input = screen.getByPlaceholderText("Or type your own answer…");
        await userEvent.type(input, "custom answer{Enter}");

        expect(onAnswer).toHaveBeenCalledWith("custom answer");
    });

    it("calls onAnswer with free-text when Send button is clicked", async () => {
        const onAnswer = vi.fn();
        render(
            <QuestionWidget
                question={question}
                onAnswer={onAnswer}
                answered={false}
            />,
        );

        const input = screen.getByPlaceholderText("Or type your own answer…");
        await userEvent.type(input, "my answer");
        await userEvent.click(screen.getByRole("button", { name: "Send" }));

        expect(onAnswer).toHaveBeenCalledWith("my answer");
    });

    it("does not call onAnswer for empty free-text submission", async () => {
        const onAnswer = vi.fn();
        render(
            <QuestionWidget
                question={question}
                onAnswer={onAnswer}
                answered={false}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Send" }));

        expect(onAnswer).not.toHaveBeenCalled();
    });

    it("disables option buttons when answered=true", () => {
        render(
            <QuestionWidget
                question={question}
                onAnswer={vi.fn()}
                answered={true}
            />,
        );

        const buttons = screen
            .getAllByRole("button")
            .filter((b) => b.textContent !== "Send");
        for (const btn of buttons) {
            expect((btn as HTMLButtonElement).disabled).toBe(true);
        }
    });

    it("hides the free-text input when answered=true", () => {
        render(
            <QuestionWidget
                question={question}
                onAnswer={vi.fn()}
                answered={true}
            />,
        );

        expect(
            screen.queryByPlaceholderText("Or type your own answer…"),
        ).toBeNull();
    });
});
