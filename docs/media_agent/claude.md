Given how directly this builds on Lumen's existing architecture (the DAG node graph, Frame metadata, BRIEF.md, three-tier agent taxonomy), let me design the harness as a concrete extension of what you already have rather than a greenfield system.

# Lumen Agent Harness Design

## 1. The orchestration loop

The core is a **plan → confirm → execute → reflect** loop, where the agent compiles a user request into a DAG of typed media operations, surfaces the plan, then executes nodes with the existing Frame propagation.

```
User intent
   │
   ▼
[Intake]  ──► resolve refs, load BRIEF.md, classify intent
   │
   ▼
[Planner] ──► emit a DAG of media ops + rationale (NO generation yet)
   │
   ▼
[Plan review] ──► present plan to user, accept edits, lock
   │
   ▼
[Executor] ──► topologically walk DAG, dispatch nodes to BullMQ
   │              each node: build prompt → call model → sign (C2PA) → emit Frame
   ▼
[Reflector] ──► check outputs against intent/eval gates, optionally re-plan failed nodes
   │
   ▼
Deliverable (concatenated/assembled)
```

The key discipline: **planning produces a graph, not prose.** The plan the user reviews _is_ the DAG that executes. This avoids the classic drift where an agent describes one thing and does another.

## 2. Three-tier taxonomy mapped to this domain

Your existing commands/skills/subagents split maps cleanly:

**Commands** (deterministic entry points, no LLM creativity):

- `/plan` — intent → DAG
- `/execute` — run a locked DAG
- `/revise` — patch a node and re-run downstream
- `/assemble` — final concatenation/muxing

**Skills** (knowledge + best-practice prompt builders, the "know-how"):

- `image-gen`, `video-gen`, `music-gen`, `speech-gen`
- `image-edit`, `video-edit`, `inpaint`, `upscale`
- `character-sheet`, `style-transfer`, `360-orbit`, `virtual-tryon`
- `synopsis`, `scene-breakdown`, `shotlist`
- `concat`, `color-match`, `audio-mux`

**Subagents** (isolated context, own loop, return a Frame):

- `Director` — owns narrative coherence across a multi-scene job
- `ArtDirector` — owns visual consistency (enforces BRIEF.md + character sheets)
- `SceneAgent` — generates one scene end-to-end (spawned per scene, parallelizable)

The Director/ArtDirector split matters for your story use case: one owns _temporal/narrative_ continuity, the other owns _visual_ continuity, and they share the character/prop reference sheets as ground truth.

## 3. Skill anatomy

Each generation skill is a SKILL.md-style bundle carrying domain best-practices so the agent doesn't reinvent prompting per call. Structure:

```
skills/video-gen/
  SKILL.md           # when to use, model selection, constraints
  prompt-template.md # dynamic prompt scaffold w/ slots
  best-practices.md   # e.g. camera-move grammar, motion bucket guidance
  models.json        # Veo 3.1 / Kling v3 / Seedance 2.0 capabilities + pricing
  eval.md            # what "good" looks like, reject criteria
```

The agent reads the relevant `models.json` + `best-practices.md` at prompt-build time. For example `video-gen/best-practices.md` encodes things like: keep clips under 10s, specify camera motion explicitly, lock subject description verbatim from the character sheet, avoid contradictory motion verbs — knowledge the planner injects into each node's prompt slot.

## 4. The Frame as the universal contract

Everything passes Frames (you already have this). For the harness, the critical Frame fields are:

- `media_type`, `uri`, `c2pa_manifest`
- `derived_from[]` — parent Frame IDs (this _is_ the DAG edge)
- `prompt_used`, `model`, `seed`, `params` — full reproducibility
- `role` — semantic tag: `reference`, `character_sheet:hero`, `scene:03`, `final`
- `brief_id` — which BRIEF.md governed this

The `role` field is what lets the ArtDirector pull "all character sheets" or the assembler pull "all scene:\* in order."

## 5. System prompt skeleton (Planner)

```
You are Lumen's Planner. You compile a creative request into a DAG of
typed media operations. You do NOT generate media — you emit a plan.

CONTEXT
- Active BRIEF: {brief.md}
- Available references: {frames where role=reference}
- Available skills: {skill registry w/ one-line descriptions}
- Model capabilities: {models.json digest}

RULES
- Decompose intent into the smallest reusable nodes (RISC-style).
- Each node: {id, skill, inputs[frame_ids], params, rationale}.
- Reuse outputs as inputs explicitly (image → video uses that image's frame).
- Keep video nodes ≤10s; if longer is needed, split into scene nodes + concat.
- Respect BRIEF.md style/constraints in every prompt slot.
- Flag ambiguity as a question in `clarifications[]` rather than guessing.
- Estimate cost per node from models.json; surface a total.

OUTPUT: JSON DAG + human-readable summary + clarifications.
```

Then the **plan-review** step renders that DAG (you have the node-graph UI already) and lets the user edit before locking.

## 6. Your four use cases as DAG patterns

**Variations → animate**

```
ref ─► [image-gen ×2 (style=BRIEF, seed varied)] ─► img_a, img_b
img_a ─► [video-gen (i2v)] ─► vid_a
img_b ─► [video-gen (i2v)] ─► vid_b
```

**Story about X**

```
intent ─► [synopsis] ─► [scene-breakdown] ─► scenes[1..n]
       ─► [character-sheet] ─► sheets (role=character_sheet:*)
for each scene (spawn SceneAgent):
   sheets+scene ─► [image-gen keyframe] ─► [video-gen ≤10s]
all scene vids ─► [concat + color-match + audio-mux] ─► final
```

The SceneAgents run in parallel via BullMQ; the Director gates the synopsis/breakdown before any generation spend.

**360 product video**

```
product refs ─► [360-orbit skill] ─► [video-gen (orbit camera path)] ─► final
```

The `360-orbit` skill encodes the camera path + multi-angle reference conditioning best-practices.

**Virtual try-on**

```
subject + garment refs ─► [virtual-tryon (image)] ─► composited img(s)
composited img ─► [video-gen (i2v)] ─► final
```

## 7. Reflection / eval gates

Wire your existing preference models (HPSv3, VideoAlign, PickScore) as **node-level gates** in the Reflector. Each generation node can carry a `min_score` threshold; on failure the Reflector either re-rolls the seed, re-prompts (optionally GEPA-optimized), or escalates to the user. This keeps the loop closed without infinite spend — cap retries per node in `params`.

---

Two design decisions worth your call before I go deeper. Which way you lean changes the planner contract and the subagent boundaries:

**A. Plan granularity** — should the planner always emit the _full_ fine-grained DAG up front, or emit a coarse plan that subagents expand at runtime (e.g. Director emits "6 scenes," each SceneAgent plans its own sub-DAG)? Coarse-then-expand is more scalable for long stories but harder to show/price up front.

**B. Where best-practice knowledge lives** — baked into skill files (static, versioned, auditable) vs. retrieved dynamically (a queryable knowledge base the planner pulls from). Static fits your "open standards, auditable, no lock-in" values; dynamic adapts faster as models change.

Want me to draft the actual SKILL.md for one generation skill (say `video-gen`) and the full Planner JSON schema as a starting implementation?
