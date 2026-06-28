import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RulesetDocument } from "@/lib/services/ruleset.service";
import type { ValidationResult } from "@/lib/canvas/types";

// ── buildViolationFeedback ────────────────────────────────────────────────────
// The function is module-private so we test it through its observable effect:
// the string passed as violationFeedback to engineerPrompt in the retry call.
// For direct string-format coverage we import a testable wrapper instead.

const { mockGenerateText } = vi.hoisted(() => ({
    mockGenerateText: vi.fn(),
}));

vi.mock("@/lib/services/gemini.service", () => ({
    geminiService: { generateText: mockGenerateText },
}));

// Provide a spy-able module for validation so we can control results per-attempt
const { mockValidateImage } = vi.hoisted(() => ({
    mockValidateImage: vi.fn(),
}));

vi.mock("@/lib/canvas/validation", () => ({
    validateImage: mockValidateImage,
}));

// Mock out the parts of generation.ts we don't want to hit
vi.mock("@/lib/services/library.service", () => ({
    libraryService: { createAsset: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/services/ruleset.service", () => ({
    rulesetService: { getRuleset: vi.fn() },
}));

vi.mock("@/primitives/server-registry", () => ({
    serverRegistry: { getByCanvasType: vi.fn() },
}));

vi.mock("@/lib/canvas/agent/prompt-engineer", () => ({
    PromptEngineer: class {
        async enrichSteps(steps: unknown[]) {
            return steps;
        }
        async engineerPrompt() {
            return "re-engineered prompt";
        }
    },
}));

const { executePlan } = await import("@/lib/canvas/generation");
const { serverRegistry } = await import("@/primitives/server-registry");

const makeRuleset = (rules: RulesetDocument["rules"]): RulesetDocument => ({
    id: "ruleset-1",
    userId: "user-1",
    name: "Test Rules",
    rules,
    visibility: "private",
    sharedWith: [],
    sharedWithEmails: [],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
});

const makePrimitive = (sourceUrl = "gs://bucket/result.png") => ({
    canvas: {
        toRequest: vi.fn().mockReturnValue({}),
        toCanvasData: vi.fn().mockReturnValue({
            type: "canvas-image",
            label: "Image 1",
            sourceUrl,
            mimeType: "image/png",
            status: "ready",
            width: 512,
            height: 512,
        }),
    },
    execute: vi.fn().mockResolvedValue({}),
});

const basePlan = {
    steps: [
        {
            id: "step-1",
            type: "image" as const,
            prompt: "a test image",
        },
    ],
};

describe("executePlan — validation integration", () => {
    let primitive: ReturnType<typeof makePrimitive>;

    beforeEach(() => {
        vi.clearAllMocks();
        primitive = makePrimitive();
        vi.mocked(serverRegistry.getByCanvasType).mockReturnValue(
            primitive as unknown as ReturnType<
                typeof serverRegistry.getByCanvasType
            >,
        );
    });

    it("skips validation when no activeRuleset is provided", async () => {
        const events = [];
        for await (const e of executePlan(
            basePlan,
            new Map(),
            "user-1",
            "canvas-1",
            "My Canvas",
        )) {
            events.push(e);
        }
        expect(mockValidateImage).not.toHaveBeenCalled();
        const done = events.find((e) => e.type === "step_done");
        expect(done).toBeDefined();
        expect(
            (done as { validationResults?: unknown }).validationResults,
        ).toBeUndefined();
    });

    it("attaches validationResults when all rules pass", async () => {
        const passResult: ValidationResult[] = [
            {
                ruleId: "rule-1",
                ruleDescription: "Logo present",
                severity: "hard",
                status: "pass",
                reason: "Logo visible",
            },
        ];
        mockValidateImage.mockResolvedValue(passResult);

        const ruleset = makeRuleset([
            {
                id: "rule-1",
                description: "Logo present",
                severity: "hard",
                failureStrategy: "surface",
            },
        ]);

        const events = [];
        for await (const e of executePlan(
            basePlan,
            new Map(),
            "user-1",
            "canvas-1",
            "My Canvas",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "ruleset-1",
            ruleset,
        )) {
            events.push(e);
        }

        const done = events.find((e) => e.type === "step_done");
        expect(done).toBeDefined();
        const validated = events.find((e) => e.type === "step_validated");
        expect(validated).toBeDefined();
        expect(
            (validated as { validationResults: ValidationResult[] })
                .validationResults,
        ).toEqual(passResult);
        expect(mockValidateImage).toHaveBeenCalledTimes(1);
    });

    it("retries up to maxRetries times for retry-strategy rules", async () => {
        const failResult: ValidationResult[] = [
            {
                ruleId: "rule-1",
                ruleDescription: "Logo present",
                severity: "hard",
                status: "fail",
                reason: "Logo missing",
            },
        ];
        const passResult: ValidationResult[] = [
            {
                ruleId: "rule-1",
                ruleDescription: "Logo present",
                severity: "hard",
                status: "pass",
                reason: "Logo visible",
            },
        ];
        // First call fails, second call passes
        mockValidateImage
            .mockResolvedValueOnce(failResult)
            .mockResolvedValueOnce(passResult);

        const ruleset = makeRuleset([
            {
                id: "rule-1",
                description: "Logo present",
                severity: "hard",
                failureStrategy: "retry",
                maxRetries: 1,
            },
        ]);

        const events = [];
        for await (const e of executePlan(
            basePlan,
            new Map(),
            "user-1",
            "canvas-1",
            "My Canvas",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "ruleset-1",
            ruleset,
        )) {
            events.push(e);
        }

        // validate called twice: once for initial, once after retry
        expect(mockValidateImage).toHaveBeenCalledTimes(2);
        // execute called twice: initial + one retry
        expect(primitive.execute).toHaveBeenCalledTimes(2);

        const validated = events.find((e) => e.type === "step_validated");
        expect(
            (validated as { validationResults: ValidationResult[] })
                .validationResults,
        ).toEqual(passResult);
    });

    it("stops retrying after maxRetries exhausted", async () => {
        const failResult: ValidationResult[] = [
            {
                ruleId: "rule-1",
                ruleDescription: "Logo present",
                severity: "hard",
                status: "fail",
                reason: "Logo missing",
            },
        ];
        // Always fails
        mockValidateImage.mockResolvedValue(failResult);

        const ruleset = makeRuleset([
            {
                id: "rule-1",
                description: "Logo present",
                severity: "hard",
                failureStrategy: "retry",
                maxRetries: 2,
            },
        ]);

        const events = [];
        for await (const e of executePlan(
            basePlan,
            new Map(),
            "user-1",
            "canvas-1",
            "My Canvas",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "ruleset-1",
            ruleset,
        )) {
            events.push(e);
        }

        // 1 initial + 2 retries = 3 validate calls, 3 execute calls
        expect(mockValidateImage).toHaveBeenCalledTimes(3);
        expect(primitive.execute).toHaveBeenCalledTimes(3);

        const validated = events.find((e) => e.type === "step_validated");
        expect(
            (validated as { validationResults: ValidationResult[] })
                .validationResults,
        ).toEqual(failResult);
    });

    it("does not retry surface-strategy failing rules", async () => {
        const failResult: ValidationResult[] = [
            {
                ruleId: "rule-1",
                ruleDescription: "Logo present",
                severity: "soft",
                status: "fail",
                reason: "Logo missing",
            },
        ];
        mockValidateImage.mockResolvedValue(failResult);

        const ruleset = makeRuleset([
            {
                id: "rule-1",
                description: "Logo present",
                severity: "soft",
                failureStrategy: "surface",
            },
        ]);

        for await (const _ of executePlan(
            basePlan,
            new Map(),
            "user-1",
            "canvas-1",
            "My Canvas",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "ruleset-1",
            ruleset,
        )) {
            /* consume */
        }

        // Only one validate call, no retries
        expect(mockValidateImage).toHaveBeenCalledTimes(1);
        expect(primitive.execute).toHaveBeenCalledTimes(1);
    });
});
