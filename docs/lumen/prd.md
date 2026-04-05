# Product requirements document — Media generation & editing agent

**Status:** Draft
**Author:** [Name]
**Last updated:** April 2026
**Codename:** Lumen (working title)

---

## 1. Vision

A single intelligent agent that can generate, edit, understand, and compose any media — images, video, audio, 3D — from natural language instructions. Users describe what they want, the agent plans and executes multi-step media workflows automatically, surfacing intermediate results for feedback.

The agent is not a collection of tools with buttons. It is a **planner that reasons over a catalog of atomic media primitives**, composing them into arbitrarily complex workflows. A user saying "make me a 30-second product ad with my logo, background music, and a voiceover in French" should trigger a fully autonomous pipeline — not a 12-step manual process.

---

## 2. Problem statement

### Current pain points

**Fragmentation.** Today's media creation requires stitching together 5–15 separate tools: Gemini for images, Veo for video, Gemini 3 TTS for voice, Google Photos for editing. Each has its own interface, auth, asset management, and export pipeline. Professional workflows waste 40–60% of time on inter-tool logistics rather than creative decisions.

**Expertise barrier.** Each tool requires domain knowledge — prompting strategies for image gen, timeline editing for video, EQ for audio. This locks out non-specialists (marketers, founders, product teams) who know *what* they want but not *how* to execute it.

**No compositional reasoning.** Existing tools handle individual steps well but cannot reason about multi-step workflows. There is no system that can take "create a product demo video from these screenshots with animated transitions and a voiceover" and autonomously decompose it into: screenshot sequencing → transition design → TTS → background music → audio mix → subtitle render → final export.

**Iteration friction.** Changing one element (swap the voiceover language, try a different color grade, resize for Stories) often means re-doing the entire workflow manually. There is no declarative pipeline where you tweak one parameter and re-render.

### Why now

- Foundation model quality for image, video, and audio generation has crossed the usability threshold in 2024–2025.
- Multi-modal LLMs (Gemini 3.1) can now reason about media composition at the planning level.
- Google Cloud Vertex AI provides a unified platform for image, video, and audio primitives.
- The cost of generation has dropped 10–50× in the past 18 months, making multi-step pipelines economically viable.

---

## 3. Target users

### Primary personas

**The solo creator / indie maker**
Small team or individual building a product, brand, or content business. Needs to produce professional-quality media (ads, social content, product shots, explainer videos) without hiring specialists or learning 10 tools. Values speed and autonomy over pixel-perfect control.

**The marketing team at a startup or SMB**
3–15 person team producing high volumes of content across channels. Needs to generate campaign assets at scale (A/B variants, multi-format exports, localized versions) while maintaining brand consistency. Values throughput, brand compliance, and platform-specific formatting.

**The creative professional augmenting their workflow**
Designer, video editor, or content producer who already has expertise but wants to accelerate specific parts of their pipeline — background removal at scale, batch style transfer, automated rough cuts, reference image generation. Values precision, controllability, and integration with existing tools.

### Secondary personas

- **E-commerce operators** needing product photography, virtual try-on, and 360° spins at scale.
- **Agencies** producing client deliverables across verticals — real estate (virtual staging), fashion (lookbooks), SaaS (product demos).
- **Internal comms teams** creating training videos, documentation walkthroughs, and onboarding content.

---

## 4. Goals & success metrics

### North star metric

**Workflows completed per user per week.** A "workflow" is any multi-primitive composition that produces a final deliverable. This measures both adoption and the agent's ability to handle real end-to-end tasks, not just single-step generation.

### Primary metrics

| Metric | Target (6 months) | Rationale |
|--------|-------------------|-----------|
| Workflow completion rate | > 75% | % of started workflows that produce a final output the user accepts |
| Avg. primitives per workflow | > 3.0 | Measures compositional depth — are users going beyond single-step generation? |
| Time to first deliverable | < 5 min (simple), < 30 min (complex) | End-to-end time from intent to export |
| Weekly active users | 10K+ | Adoption |
| NPS | > 50 | User satisfaction |

### Secondary metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Primitive success rate | > 95% | % of individual primitive calls that succeed without retry |
| User iteration depth | > 2.5 rounds | Avg. number of refinement cycles per workflow, indicating users trust the system enough to iterate |
| Brand kit adoption | > 40% of teams | % of team accounts that configure and actively use a brand kit |
| Multi-format export rate | > 30% | % of workflows that export to 2+ formats (indicates cross-platform value) |

---

## 5. User stories

### P0 — Must have for launch

**US-01 — Single-step generation**
As a creator, I want to generate an image / video / music / voiceover from a text description so that I can produce media assets without specialized tools.
- Acceptance: supports text→image, text→video, image→video, text→music, text→speech.
- Quality: outputs are competitive with best-in-class standalone tools (Gemini 3.1 Image, Veo, Lyria).

**US-02 — Single-step editing**
As a creator, I want to edit existing media (remove background, inpaint, upscale, trim video, overlay text) by describing what I want changed.
- Acceptance: supports inpaint/outpaint, background removal, upscale, color correction, video trim/cut/merge, text/graphic overlay, format conversion.

**US-03 — Multi-step workflow from natural language**
As a user, I want to describe a complex media task in plain language and have the agent plan and execute it as a multi-step pipeline.
- Acceptance: agent decomposes intent into a DAG of primitives, shows the plan, executes with parallelism where possible, and surfaces the final output.
- Example: "Take this product photo, remove the background, put it on a studio backdrop, add my logo in the bottom right, and export in 1:1 and 9:16."

**US-04 — Intermediate review and course correction**
As a user, I want to review intermediate outputs during long workflows and provide feedback before the agent continues.
- Acceptance: configurable checkpoints where the workflow pauses. User can approve, reject (with notes), or modify parameters before proceeding.

**US-05 — Brand kit**
As a team lead, I want to configure brand assets (logo, fonts, color palette, tone guidelines) once and have them automatically applied to all generated content.
- Acceptance: brand kit is stored per-workspace. Primitives like text overlay, color correction, and style transfer reference it by default.

**US-06 — Multi-format export**
As a marketer, I want to export a single piece of content in multiple formats and aspect ratios (feed post, story, banner) in one step.
- Acceptance: user specifies target platforms, agent handles resizing, reformatting, and re-rendering. Outputs are packaged as a downloadable bundle.

### P1 — High priority, post-launch

**US-07 — Ad generation with overlays**
As a marketer, I want to generate ad images/videos with text, CTA buttons, and my logo composited on top, following brand guidelines.

**US-08 — Virtual try-on**
As an e-commerce operator, I want to upload a product (garment) and a model photo and see the product realistically rendered on the model.

**US-09 — Product photography**
As a seller, I want to take a raw product photo (or even a phone snapshot) and get studio-quality output with professional lighting and background.

**US-10 — Webapp / product video overview**
As a SaaS founder, I want to provide screenshots or a URL of my product and get a polished demo video with animated transitions, zoom effects, and a voiceover.

**US-11 — Policy and guideline validation**
As a brand manager, I want to validate generated content against our brand guidelines and content policies before publishing, with an automated report of violations.

**US-12 — Template system**
As a team member, I want to create reusable workflow templates (e.g., "weekly social post bundle") that can be re-run with different inputs.

### P2 — Important, later phases

**US-13 — End-to-end video production**
As a creator, I want to describe a video concept and have the agent produce it end-to-end: synopsis → storyboard → scenes → voiceover → music → edit → subtitles → final cut.

**US-14 — 360° product spin**
As an e-commerce operator, I want to upload 2–4 reference photos of a product and get a smooth 360° spin video.

**US-15 — Localization pipeline**
As an international marketer, I want to take existing ad/video content and automatically produce localized versions (translated text overlays, dubbed voiceover, localized subtitles) for target markets.

**US-16 — A/B variant generation**
As a growth marketer, I want to generate N variants of an ad (different headlines, hero images, CTAs) for multivariate testing.

**US-17 — Lip-synced talking head**
As a content creator, I want to generate a realistic talking-head video from a script, with lip-synced speech and natural expression.

**US-18 — 3D product viewer**
As a seller, I want to generate an interactive 3D model of my product from reference photos, embeddable on my website.

---

## 6. Feature requirements

### 6.1 Primitive layer

Each primitive is a self-contained operation with typed inputs and outputs.

#### 6.1.1 Generation primitives

| Primitive | Input | Output | Priority | Model candidates |
|-----------|-------|--------|----------|-----------------|
| text → image | prompt, style params, resolution, seed | image | P0 | Gemini 3.1 Image (Pro/Flash) |
| text → video | prompt, duration, resolution, seed | video | P0 | Veo (Vertex AI) |
| image → video | image + prompt, duration | video | P0 | Veo (Vertex AI) |
| text → music | prompt, duration, genre, mood | audio | P0 | Lyria / MusicFX (Vertex AI) |
| text → SFX | prompt, duration | audio | P1 | Vertex AI AudioFX |
| text → speech | text, voice ID, language, emotion | audio | P0 | Gemini 3 TTS |
| text → 3D asset | prompt, format | mesh | P2 | Vertex AI 3D (Experimental) |
| image → 3D asset | image(s), format | mesh | P2 | Vertex AI 3D (Experimental) |

#### 6.1.2 Understanding primitives

| Primitive | Input | Output | Priority |
|-----------|-------|--------|----------|
| Image captioning | image | text description | P0 |
| Video scene detection | video | list of scene boundaries with timestamps | P0 |
| Object detection | image | bounding boxes + labels | P1 |
| Segmentation | image + target | mask (PNG) | P0 |
| Face detection | image | bounding boxes + landmarks | P1 |
| Pose estimation | image | skeleton keypoints | P1 |
| Depth estimation | image | depth map (PNG) | P1 |
| OCR | image | extracted text + positions | P0 |
| Speech → text | audio | transcript + timestamps | P0 |
| Style / aesthetic scoring | image | quality score + attributes | P1 |
| Content classification | image/video | labels (NSFW, brand safety, etc.) | P1 |
| Audio source separation | audio | separated tracks (vocals, instruments, noise) | P2 |

#### 6.1.3 Edit / transform primitives

| Primitive | Input | Output | Priority |
|-----------|-------|--------|----------|
| Inpaint / outpaint | image + mask + prompt | image | P0 |
| Background removal | image | image (RGBA) + mask | P0 |
| Upscale / super-res | image, scale factor | image | P0 |
| Style transfer | image + style reference | image | P1 |
| Color correction | image/video + adjustments | image/video | P0 |
| Video trim / cut / merge | video + edit list | video | P0 |
| Transitions & effects | video clips + transition type | video | P1 |
| Frame interpolation | video, target FPS | video | P2 |
| Video stabilization | video | video | P2 |
| Audio mix / EQ / denoise | audio tracks + settings | audio | P0 |
| Text / graphic overlay | media + overlay spec | media | P0 |
| Subtitle rendering | video + transcript/SRT | video | P0 |
| Lip sync | video/image + audio | video | P2 |
| Face swap | image/video + source face | image/video | P2 |
| Motion tracking | video + target | tracking data | P2 |
| Format conversion | media + target format/aspect | media | P0 |
| Watermark | media + watermark asset | media | P1 | Google Cloud Video Intelligence / Image overlays |

#### 6.1.4 Infrastructure

| Component | Description | Priority |
|-----------|-------------|----------|
| Brand kit | Per-workspace storage of logos, fonts, colors, tone guidelines. Referenced by overlay, style, and validation primitives. | P0 |
| Template engine | Parameterized workflow definitions. Variables for inputs, fixed structure for steps. | P1 |
| Asset library | Persistent storage, tagging, and semantic search for generated/uploaded assets. | P1 |
| Policy rules engine | Declarative rules evaluated against understanding primitive outputs. Returns pass/fail + violation list. | P1 |
| Version history | Track all iterations of a workflow, enable rollback and diff. | P2 |
| Render queue | Async job management with priority, progress tracking, and webhook notifications. | P1 |

### 6.2 Agent / planner layer

#### 6.2.1 Intent classification

The agent receives natural language input and must:

1. **Classify intent** — Is this a single-step primitive call or a multi-step workflow?
2. **Match to template** — Does the request match a known workflow template? If yes, fill parameters.
3. **Novel composition** — If no template matches, reason over the primitive catalog to construct a DAG.
4. **Parameter resolution** — Determine model, resolution, duration, brand kit, output format from context and defaults.

#### 6.2.2 Execution planning

The planner produces a **directed acyclic graph (DAG)** where:

- Each node is a primitive call with fully specified parameters.
- Edges represent data dependencies (output of node A is input to node B).
- Independent branches are marked for parallel execution.
- Checkpoint nodes are inserted at user-configurable points.

The plan is presented to the user in natural language (with an option to see the detailed DAG) before execution begins.

#### 6.2.3 Execution engine

- Executes DAG nodes, parallelizing independent branches.
- Streams intermediate results to the user as they complete.
- On primitive failure: retries with backoff, then falls back to alternative model if available, then surfaces error with suggested manual action.
- On checkpoint: pauses workflow, presents intermediate output, waits for user approval/feedback.
- On user feedback: modifies downstream parameters or re-runs the failed node with adjustments.

#### 6.2.4 Output assembly

- Collects final outputs from all terminal DAG nodes.
- Packages into requested format(s) — single file, multi-format bundle, or preview.
- Stores in asset library with metadata (workflow ID, parameters, generation date).
- Presents download links and inline previews.

### 6.3 Reviewer layer

After execution, an optional review step:

1. **Quality check** — Run aesthetic scoring on visual outputs, audio quality check on audio.
2. **Brand compliance** — Compare against brand kit (logo placement, color palette, font usage).
3. **Policy validation** — Run content classification and evaluate against policy rules.
4. **Report** — Surface pass/fail with specific violations and suggested fixes.
5. **Auto-fix loop** — For fixable violations (wrong aspect ratio, missing watermark, logo too small), automatically re-run relevant primitives and re-validate.

---

## 7. Technical architecture

### 7.1 High-level stack

```
┌─────────────────────────────────────────┐
│              Client layer               │
│  Web app / API / SDK / Chat interface   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│            Agent / planner              │
│  LLM backbone (Gemini 3.1 Pro) with    │
│  tool-use over primitive catalog        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Orchestration layer            │
│  Cloud Workflows, Cloud Tasks,          │
│  retry logic, webhook dispatch          │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           Primitive adapters            │
│  Unified interface per primitive type.  │
│  Each adapter wraps Google Cloud models.│
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Model providers (Vertex AI)    │
│  Gemini 3.1 Image, Veo, Lyria,          │
│  Gemini 3 TTS, Gemini 3.1 Multimodal    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│             Storage layer               │
│  Cloud Storage (GCS), Firestore,        │
│  workflow history, Cloud Memorystore    │
└─────────────────────────────────────────┘
```

### 7.2 Primitive adapter interface

Every primitive adapter implements a common interface:

```
interface PrimitiveAdapter {
  name: string
  inputSchema: JSONSchema     // typed inputs
  outputSchema: JSONSchema    // typed outputs
  providers: Provider[]       // ranked list of model providers
  estimate(input): { cost, duration, quality }
  execute(input): AsyncGenerator<Progress, Output>
  validate(output): ValidationResult
}
```

This allows the planner to reason about primitives generically and enables hot-swapping of model providers without changing workflow logic.

### 7.3 Key technical decisions

**Model routing.** Each primitive adapter supports multiple providers (e.g., text→image can use Flux, DALL-E, or Ideogram). The planner selects based on: quality requirements, cost budget, latency constraints, and feature support (e.g., only some models support ControlNet-style conditioning).

**Typed I/O.** Every primitive declares typed inputs and outputs. The planner validates DAG edges at plan time — a segmentation primitive outputs a mask, which is a valid input to inpainting. Type mismatches are caught before execution.

**Idempotency and caching.** Primitive calls with identical inputs and parameters return cached results. This enables: cheap iteration (changing one downstream step doesn't re-run upstream), A/B variant generation (only the varying step re-runs), and cost control.

**Streaming intermediates.** Long primitives (video generation, audio generation) stream progress updates. The orchestration layer surfaces these to the client as they arrive, not just at completion.

---

## 8. User experience

### 8.1 Interaction model

The primary interface is a **chat with media previews.** The user describes what they want. The agent:

1. Shows a plan summary ("I'll remove the background, generate a studio backdrop, overlay your logo, and export in two formats").
2. Executes with live progress indicators.
3. Surfaces inline previews at each checkpoint.
4. Presents the final output(s) with download and iteration options.

For power users, a **workflow editor** shows the DAG visually and allows manual node configuration, re-ordering, and parameter tuning.

### 8.2 Key UX flows

**Flow 1 — Simple generation**
User: "Generate a hero image for my SaaS landing page, dark theme, abstract geometric shapes"
→ Agent calls text→image with resolved parameters.
→ Shows 4 variants inline.
→ User picks one, optionally requests edits ("make the accent color match our brand blue").

**Flow 2 — Multi-step workflow**
User: "Make me a 15-second Instagram Reel ad for this product" + uploads product photo
→ Agent shows plan: background removal → studio shot → text overlay (product name + price from brand kit) → image→video (zoom + rotate) → music gen (upbeat, 15s) → audio mix → subtitle render → format conversion (9:16) → watermark.
→ User approves plan.
→ Agent executes, shows studio shot for approval at checkpoint.
→ User approves, agent continues to final output.

**Flow 3 — Template re-use**
User: "Run the weekly social bundle template with this week's product photos"
→ Agent loads saved template, injects new images as inputs.
→ Executes full pipeline, exports 5 variants × 3 formats.
→ Packaged as downloadable bundle.

### 8.3 Feedback and iteration

At any point the user can:

- **Redo a step** — "Regenerate the background, more minimal."
- **Tweak parameters** — "Make the music more upbeat" or "Change the voiceover to British English."
- **Branch** — "Give me a version with a blue CTA and a version with an orange CTA."
- **Rollback** — "Go back to the version before I changed the font."

The agent tracks the full version tree and can cheaply re-render from any point.

---

## 9. Launch strategy

### Phase 1 — Foundation (months 1–3)

**Goal:** Solid single-step generation and editing with basic multi-step composition.

- Ship all P0 primitives (generation, understanding, editing).
- Ship the planner with support for 3–5 hardcoded workflow templates.
- Ship brand kit (basic: logo, colors, fonts).
- Ship chat interface with inline previews.
- No template system, no asset library, no review layer.

**Success criteria:** 1K users completing 3+ workflows/week. Workflow completion rate > 60%.

### Phase 2 — Composition (months 4–6)

**Goal:** The agent can compose novel workflows and handle complex multi-step tasks.

- Ship novel composition (planner reasons over primitive catalog for arbitrary workflows).
- Ship all P1 primitives.
- Ship template system and asset library.
- Ship reviewer layer (quality + brand + policy).
- Ship render queue for async long-running jobs.
- Expand to 15+ workflow templates.

**Success criteria:** Avg. primitives per workflow > 3.0. Template adoption > 20% of active users. NPS > 40.

### Phase 3 — Scale & differentiation (months 7–12)

**Goal:** Platform-level capabilities that create defensibility.

- Ship all P2 primitives (3D, lip sync, face swap, motion tracking).
- Ship end-to-end video production pipeline.
- Ship localization pipeline.
- Ship API and SDK for programmatic access.
- Ship team collaboration (shared workspaces, approval workflows, commenting on outputs).
- Marketplace for community-created templates.

**Success criteria:** 10K weekly active users. Avg. 5+ workflows/week. Enterprise pipeline emerging.

---

## 10. Risks & mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Model quality inconsistency** — different providers produce varying quality, breaking multi-step workflows | High | High | Primitive adapters include quality validation. Planner selects best provider per step. Fallback chain on quality failure. |
| **Cost blowup on complex workflows** — a 10-step pipeline calling expensive models can cost $5–50 per run | High | High | Cost estimation before execution. Per-workflow budget caps. Model routing that balances cost/quality. Caching to avoid redundant calls. |
| **Latency on long pipelines** — end-to-end movie production could take 30+ minutes | Medium | High | Streaming intermediates so users see progress. Parallel execution of independent branches. Async render queue with notifications. |
| **Copyright and IP** — generated content may infringe on training data copyrights, licensed music, or brand assets | High | Medium | Content classification and provenance tracking. Licensed music libraries as default. Clear ToS around generated content ownership. |
| **Misuse** — deepfakes, non-consensual face swap, misleading ads | High | Medium | Face swap requires consent verification. Content classification flags synthetic media. Watermarking on all generated content. Rate limiting on face-related primitives. |
| **Provider lock-in** — dependency on external model providers who may change pricing or APIs | Medium | Medium | Adapter abstraction layer. Support 2+ providers per primitive type. Self-hosted fallbacks for critical primitives. |
| **Planning failures** — agent misinterprets intent or produces invalid DAGs | Medium | High | Plan preview before execution. Typed I/O validation at plan time. Fallback to template matching when novel composition fails. User can manually edit the plan. |

---

## 11. Open questions

1. **Pricing model.** Per-workflow? Per-primitive-call? Subscription with credits? Usage-based pricing aligns incentives but is unpredictable for users. Credit bundles may be the best compromise.

2. **Self-hosted vs. cloud.** Do we offer a self-hosted option for enterprise customers with data sensitivity requirements? The adapter abstraction supports this, but operational complexity is high.

3. **Model selection transparency.** How much should users see about which model is being used for each primitive? Power users want control; casual users want it invisible. Proposal: smart defaults with an "advanced" toggle.

4. **Real-time collaboration.** Should multiple users be able to collaborate on a workflow in real time (like Figma)? Or is async (comment + approve) sufficient for V1?

5. **Offline / edge generation.** Should we support on-device generation for latency-sensitive primitives (background removal, upscaling)? This limits model quality but improves UX for interactive editing.

6. **Marketplace economics.** If we launch a template marketplace in Phase 3, what's the revenue split? How do we quality-control community templates?

7. **Composability ceiling.** At what workflow complexity does the agent planner break down? 5 steps? 15? 50? We need empirical data from Phase 1 to set expectations.

8. **Audio-visual sync.** For video + music + voiceover workflows, how precisely do we need to synchronize? Frame-accurate? Beat-accurate? This has major implications for the editing primitives we need.

---

## Appendix A — Primitive catalog (full reference)

See `media_agent_architecture.md` for the complete primitive taxonomy and composed workflow decompositions.

## Appendix B — Competitive landscape

| Competitor | Strengths | Gaps |
|------------|-----------|------|
| **Runway** | Best-in-class video gen, professional user base | Single-tool, no multi-step composition, no audio |
| **Pika** | Fast video gen, good UI | Limited editing, no pipeline orchestration |
| **Canva** | Massive user base, templates, brand kit | AI features are add-ons, not compositional. No video gen. |
| **Adobe Firefly** | Integrated in Creative Cloud | Locked to Adobe ecosystem, limited autonomy |

**Our differentiation:** No competitor offers an *agent* that reasons across modalities and composes multi-step workflows autonomously. Everyone else is a tool; we are the orchestrator.

## Appendix C — Glossary

| Term | Definition |
|------|------------|
| **Primitive** | An atomic, single-step media operation (generate, edit, understand). The smallest unit of work. |
| **Workflow** | A directed acyclic graph (DAG) of primitives that produces a final deliverable. |
| **Template** | A saved, parameterized workflow definition that can be re-run with different inputs. |
| **Checkpoint** | A point in a workflow where execution pauses for user review and approval. |
| **Brand kit** | A per-workspace collection of brand assets (logo, fonts, colors, guidelines) applied to generation. |
| **Adapter** | An abstraction layer wrapping one or more model providers behind a common interface for a given primitive. |
| **Planner** | The LLM-powered agent component that decomposes user intent into a workflow DAG. |
| **Executor** | The runtime component that runs DAG nodes, manages parallelism, retries, and checkpoints. |
| **Reviewer** | The post-execution validation component that checks quality, brand compliance, and policy. |