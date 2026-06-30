---
name: mb-implement
description: >
    Implements a feature end-to-end — spec, plan, build, review, simplify, ship — fully autonomous
    from a feature description file. Use when you have a feature described in a file and want the
    full pipeline to run without pausing for input.
---

# mb-implement — End-to-End Feature Implementation

Takes a path to a feature description file and drives the full implementation pipeline autonomously.
At every decision point, apply your best judgment and default to the most conservative, idiomatic
choice for this codebase. Do not pause for human input between phases.

## Input

The feature file path is passed as the skill argument (`$ARGUMENTS`). Read the file first.
If the file does not exist, stop and report the error.

---

## Phase 1 — Spec

Invoke the **agent-skills:spec-driven-development** skill.

Derive the spec from the feature file — do not ask clarifying questions. Where ambiguous, default
to the minimal scope that satisfies the described goal. Cover all six areas: objective, commands,
project structure, code style, testing strategy, and boundaries.

Save to `tasks/spec.md` (not `SPEC.md` in root). Announce `✓ Spec → tasks/spec.md` and continue.

---

## Phase 2 — Plan

Invoke the **agent-skills:planning-and-task-breakdown** skill.

Read `tasks/spec.md` and relevant codebase sections. Slice work vertically — one complete path per
task. Write each task with acceptance criteria and a verification step. Save the plan to
`tasks/plan.md` and the ordered task list to `tasks/todo.md`.

Do not wait for human review. Announce `✓ Plan → tasks/todo.md` and continue.

---

## Phase 3 — Build

Invoke **agent-skills:incremental-implementation** alongside **agent-skills:test-driven-development**.

Work through every task in `tasks/todo.md` in order. For each task:

1. Read the acceptance criteria
2. Write a failing test (RED)
3. Implement minimum code to pass (GREEN)
4. Run `bun run check`, `bun run lint`, `bun run test` — fix all errors before moving on
5. Commit with a descriptive message
6. Mark the task complete in `tasks/todo.md`

If any check fails, apply **agent-skills:debugging-and-error-recovery** and resolve before
continuing. Never skip a task or leave failures unresolved.

Announce `✓ Build complete` when all tasks pass all checks.

---

## Phase 4 — Review and fix

Invoke **agent-skills:code-review-and-quality**.

Review all changes introduced in this session across five axes: correctness, readability,
architecture, security, performance. Categorize findings as Critical, Important, or Suggestion.

Fix all Critical and Important findings. Apply Suggestions only when they are unambiguous
improvements with no behavior risk. Run `bun run preflight` after fixes; resolve any new failures.

Announce `✓ Review complete` and continue.

---

## Phase 5 — Simplify

Invoke **agent-skills:code-simplification**.

Target code introduced in this session. Apply simplifications incrementally — run `bun run test`
after each one. Revert any simplification that breaks tests. Run `bun run preflight` at the end.

Announce `✓ Simplification complete` and continue.

---

## Phase 6 — Ship

Invoke **agent-skills:shipping-and-launch**.

Spawn **code-reviewer**, **security-auditor**, and **test-engineer** subagents in parallel (all
three Agent tool calls in a single turn). Merge their reports. Fix all blockers. If a Critical
finding cannot be fixed, halt and report — do not ship.

Once GO: confirm `bun run preflight` passes, then output the ship decision with a rollback plan.

---

## Completion report

```
Feature: [name from feature file]
Tasks completed: N
Commits: [list]
Review findings fixed: N critical, N important
Final status: GO / NO-GO
```
