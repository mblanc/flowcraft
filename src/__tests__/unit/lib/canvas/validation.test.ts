import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RulesetDocument } from "@/lib/services/ruleset.service";

const { mockGenerateText } = vi.hoisted(() => ({
    mockGenerateText: vi.fn(),
}));

vi.mock("@/lib/services/gemini.service", () => ({
    geminiService: {
        generateText: mockGenerateText,
    },
}));

// Import after mocks are set up
const { validateImage } = await import("@/lib/canvas/validation");

const baseRuleset = (): RulesetDocument => ({
    id: "ruleset-1",
    userId: "user-1",
    name: "Brand Rules",
    rules: [
        {
            id: "rule-1",
            description: "Logo in top-right",
            severity: "hard",
            failureStrategy: "surface",
        },
        {
            id: "rule-2",
            description: "Background must be white",
            severity: "soft",
            failureStrategy: "surface",
        },
    ],
    visibility: "private",
    sharedWith: [],
    sharedWithEmails: [],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
});

describe("validateImage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array when ruleset has no rules", async () => {
        const ruleset = { ...baseRuleset(), rules: [] };
        const results = await validateImage("gs://bucket/image.png", ruleset);
        expect(results).toEqual([]);
        expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("calls Gemini with the image URI as a uri part", async () => {
        mockGenerateText.mockResolvedValue(
            "RULE rule-1: PASS — Logo visible in top-right\nRULE rule-2: PASS — Background is white",
        );
        await validateImage("gs://bucket/image.png", baseRuleset());
        expect(mockGenerateText).toHaveBeenCalledWith(
            expect.objectContaining({
                parts: expect.arrayContaining([
                    expect.objectContaining({
                        kind: "uri",
                        uri: "gs://bucket/image.png",
                    }),
                ]),
            }),
        );
    });

    it("parses all PASS results correctly", async () => {
        mockGenerateText.mockResolvedValue(
            "RULE rule-1: PASS — Logo is in the top-right quadrant\nRULE rule-2: PASS — Background is white",
        );
        const results = await validateImage(
            "gs://bucket/image.png",
            baseRuleset(),
        );
        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({
            ruleId: "rule-1",
            status: "pass",
            severity: "hard",
        });
        expect(results[1]).toMatchObject({
            ruleId: "rule-2",
            status: "pass",
            severity: "soft",
        });
    });

    it("parses FAIL results and extracts reason", async () => {
        mockGenerateText.mockResolvedValue(
            "RULE rule-1: FAIL — Logo is missing\nRULE rule-2: PASS — Background is correct",
        );
        const results = await validateImage(
            "gs://bucket/image.png",
            baseRuleset(),
        );
        expect(results[0]).toMatchObject({
            ruleId: "rule-1",
            status: "fail",
            reason: "Logo is missing",
            severity: "hard",
        });
        expect(results[1]).toMatchObject({
            ruleId: "rule-2",
            status: "pass",
        });
    });

    it("marks rules with no matching response line as fail with parse error", async () => {
        mockGenerateText.mockResolvedValue(
            "RULE rule-1: PASS — Logo is present",
        );
        const results = await validateImage(
            "gs://bucket/image.png",
            baseRuleset(),
        );
        expect(results).toHaveLength(2);
        const missing = results.find((r) => r.ruleId === "rule-2");
        expect(missing).toMatchObject({
            status: "fail",
            reason: "parse error",
        });
    });

    it("returns all-fail with service error reason when Gemini throws", async () => {
        mockGenerateText.mockRejectedValue(new Error("API error"));
        const results = await validateImage(
            "gs://bucket/image.png",
            baseRuleset(),
        );
        expect(results).toHaveLength(2);
        expect(results.every((r) => r.status === "fail")).toBe(true);
        expect(
            results.every((r) => r.reason === "validation service error"),
        ).toBe(true);
    });

    it("handles em-dash and hyphen separator variants", async () => {
        mockGenerateText.mockResolvedValue(
            "RULE rule-1: PASS - Logo present\nRULE rule-2: FAIL – Background is grey",
        );
        const results = await validateImage(
            "gs://bucket/image.png",
            baseRuleset(),
        );
        expect(results[0].status).toBe("pass");
        expect(results[1].status).toBe("fail");
    });

    it("skips lines with unknown rule IDs", async () => {
        mockGenerateText.mockResolvedValue(
            "RULE unknown-id: PASS — Ignored\nRULE rule-1: PASS — Present\nRULE rule-2: PASS — White",
        );
        const results = await validateImage(
            "gs://bucket/image.png",
            baseRuleset(),
        );
        expect(results).toHaveLength(2);
        expect(results.find((r) => r.ruleId === "unknown-id")).toBeUndefined();
    });
});
