/**
 * Typed eval harness for CanvasAgentRunner.
 *
 * Mirrors the ADK evalset/criteria pattern in TypeScript:
 *   - EvalCase    ≈ ADK eval_case  (input + expected criteria)
 *   - Criterion   ≈ ADK criteria   (named predicate → 0 | 1 score)
 *   - EvalResult  ≈ ADK eval run output per case
 *
 * Usage:
 *   const results = await runEval(runner, cases);
 *   printEvalResults(results);  // prints ASCII score table
 *   assertEvalPasses(results);  // throws if any case is below threshold
 */

import type { CanvasAgentRunner } from "../../lib/canvas/adk/runner";
import type { AgentEvent, AgentInput } from "../../lib/canvas/types";
import type { GenerationStep } from "../../lib/canvas/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Criterion {
    name: string;
    /** Returns a score 0–1. Binary criteria return 0 or 1. */
    score(steps: GenerationStep[], events: AgentEvent[]): number;
}

export interface EvalCase {
    id: string;
    description: string;
    input: AgentInput;
    /** Criteria that must pass for this case. */
    criteria: Criterion[];
    /** Minimum mean score across all criteria to pass (default 1.0). */
    threshold?: number;
}

export interface CriterionResult {
    name: string;
    score: number;
    passed: boolean;
}

export interface EvalCaseResult {
    id: string;
    description: string;
    criteriaResults: CriterionResult[];
    meanScore: number;
    passed: boolean;
    threshold: number;
    durationMs: number;
    error?: string;
}

// ─── Built-in criteria ────────────────────────────────────────────────────────

export const criteria = {
    /** Plan must have at least `n` steps. */
    minSteps: (n: number): Criterion => ({
        name: `min_steps_${n}`,
        score: (steps) => (steps.length >= n ? 1 : 0),
    }),

    /** Plan must have exactly `n` steps. */
    exactSteps: (n: number): Criterion => ({
        name: `exact_steps_${n}`,
        score: (steps) => (steps.length === n ? 1 : 0),
    }),

    /** Plan must have at least `n` steps of a given type. */
    minStepsOfType: (type: "image" | "video", n: number): Criterion => ({
        name: `min_${type}_steps_${n}`,
        score: (steps) =>
            steps.filter((s) => s.type === type).length >= n ? 1 : 0,
    }),

    /** All steps must use the given aspect ratio. */
    allAspectRatio: (ar: string): Criterion => ({
        name: `all_aspect_ratio_${ar.replace(":", "x")}`,
        score: (steps) =>
            steps.length > 0 && steps.every((s) => s.aspectRatio === ar)
                ? 1
                : 0,
    }),

    /** All video steps must have a duration in the allowed set. */
    validVideoDurations: (allowed: number[] = [4, 6, 8]): Criterion => ({
        name: "valid_video_durations",
        score: (steps) => {
            const videoSteps = steps.filter((s) => s.type === "video");
            if (videoSteps.length === 0) return 1;
            return videoSteps.every(
                (s) => s.duration === undefined || allowed.includes(s.duration),
            )
                ? 1
                : 0;
        },
    }),

    /** At least one step must reference the given canvas node ID. */
    refNodeUsed: (nodeId: string): Criterion => ({
        name: `ref_node_used_${nodeId}`,
        score: (steps) =>
            steps.some(
                (s) =>
                    s.referenceNodeIds?.includes(nodeId) ||
                    s.firstFrameNodeId === nodeId ||
                    s.lastFrameNodeId === nodeId,
            )
                ? 1
                : 0,
    }),

    /** No step references a node ID outside the provided valid set. */
    noHallucinatedNodeIds: (validIds: string[]): Criterion => ({
        name: "no_hallucinated_node_ids",
        score: (steps) => {
            const valid = new Set(validIds);
            for (const s of steps) {
                if (s.firstFrameNodeId && !valid.has(s.firstFrameNodeId))
                    return 0;
                if (s.lastFrameNodeId && !valid.has(s.lastFrameNodeId))
                    return 0;
                if (s.referenceNodeIds?.some((id: string) => !valid.has(id)))
                    return 0;
            }
            return 1;
        },
    }),

    /** Video steps that depend on same-plan images must have a dependsOn or firstFrameNodeId set. */
    videoStepsAreLinked: (): Criterion => ({
        name: "video_steps_linked",
        score: (steps) => {
            const videoSteps = steps.filter((s) => s.type === "video");
            if (videoSteps.length === 0) return 1;
            return videoSteps.every(
                (s) =>
                    s.dependsOn?.length ||
                    s.firstFrameNodeId ||
                    s.referenceNodeIds?.length,
            )
                ? 1
                : 0;
        },
    }),

    /** Agent must emit at least one suggested action. */
    hasSuggestedActions: (): Criterion => ({
        name: "has_suggested_actions",
        score: (_, events) => {
            const e = events.find((ev) => ev.type === "actions");
            if (!e || e.type !== "actions") return 0;
            return e.actions.length > 0 ? 1 : 0;
        },
    }),

    /** Agent must not emit suggested actions. */
    noSuggestedActions: (): Criterion => ({
        name: "no_suggested_actions",
        score: (_, events) => {
            const e = events.find((ev) => ev.type === "actions");
            return e ? 0 : 1;
        },
    }),

    /** Agent must not emit an error event. */
    noErrors: (): Criterion => ({
        name: "no_errors",
        score: (_, events) => (events.some((e) => e.type === "error") ? 0 : 1),
    }),

    /** Agent must produce a plan (non-empty steps). */
    hasPlan: (): Criterion => ({
        name: "has_plan",
        score: (steps) => (steps.length > 0 ? 1 : 0),
    }),

    /** Agent must emit at least one text_nodes event. */
    hasTextNodes: (): Criterion => ({
        name: "has_text_nodes",
        score: (_, events) =>
            events.some((e) => e.type === "text_nodes") ? 1 : 0,
    }),

    /** plan_text_nodes must be emitted before any plan event. */
    textNodesBeforeProduction: (): Criterion => ({
        name: "text_nodes_before_production",
        score: (_, events) => {
            const firstTextIdx = events.findIndex(
                (e) => e.type === "text_nodes",
            );
            const firstPlanIdx = events.findIndex((e) => e.type === "plan");
            if (firstTextIdx === -1) return 0;
            if (firstPlanIdx === -1) return 1;
            return firstTextIdx < firstPlanIdx ? 1 : 0;
        },
    }),
};

// ─── Runner ───────────────────────────────────────────────────────────────────

async function collectEvents(
    runner: CanvasAgentRunner,
    input: AgentInput,
): Promise<AgentEvent[]> {
    const events: AgentEvent[] = [];
    for await (const event of runner.stream(input)) {
        events.push(event);
    }
    return events;
}

function extractSteps(events: AgentEvent[]): GenerationStep[] {
    const planEvent = events.find((e) => e.type === "plan");
    if (!planEvent || planEvent.type !== "plan") return [];
    return planEvent.plan.steps;
}

export async function runEval(
    runner: CanvasAgentRunner,
    cases: EvalCase[],
): Promise<EvalCaseResult[]> {
    const results: EvalCaseResult[] = [];

    for (const c of cases) {
        const threshold = c.threshold ?? 1.0;
        const t0 = Date.now();
        let events: AgentEvent[] = [];
        let error: string | undefined;

        try {
            events = await collectEvents(runner, c.input);
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        }

        const steps = extractSteps(events);
        const criteriaResults: CriterionResult[] = c.criteria.map((cr) => {
            const score = error ? 0 : cr.score(steps, events);
            return { name: cr.name, score, passed: score >= 1.0 };
        });

        const meanScore =
            criteriaResults.length > 0
                ? criteriaResults.reduce((sum, r) => sum + r.score, 0) /
                  criteriaResults.length
                : 0;

        results.push({
            id: c.id,
            description: c.description,
            criteriaResults,
            meanScore,
            passed: meanScore >= threshold,
            threshold,
            durationMs: Date.now() - t0,
            error,
        });
    }

    return results;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

export function printEvalResults(results: EvalCaseResult[]): void {
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    console.log(
        "\n╔══════════════════════════════════════════════════════════════╗",
    );
    console.log(
        `║  Canvas Agent Eval  —  ${passed}/${total} cases passed`.padEnd(64) +
            "║",
    );
    console.log(
        "╚══════════════════════════════════════════════════════════════╝",
    );

    for (const r of results) {
        const status = r.passed ? "✓ PASS" : "✗ FAIL";
        const score = `${(r.meanScore * 100).toFixed(0)}%`;
        const dur = `${(r.durationMs / 1000).toFixed(1)}s`;
        console.log(`\n  ${status}  [${score}]  ${r.id}  (${dur})`);
        console.log(`         ${r.description}`);
        if (r.error) {
            console.log(`         ERROR: ${r.error}`);
        }
        for (const cr of r.criteriaResults) {
            const icon = cr.passed ? "  ✓" : "  ✗";
            console.log(`    ${icon}  ${cr.name}  (${cr.score.toFixed(2)})`);
        }
    }
    console.log("");
}

export function assertEvalPasses(results: EvalCaseResult[]): void {
    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
        const summary = failed
            .map(
                (r) =>
                    `  ${r.id}: score=${(r.meanScore * 100).toFixed(0)}% threshold=${(r.threshold * 100).toFixed(0)}%`,
            )
            .join("\n");
        throw new Error(`${failed.length} eval case(s) failed:\n${summary}`);
    }
}
