# Design specification — Media generation & editing agent

**Status:** Draft
**Author:** Product Designer
**Last updated:** April 2026
**Companion docs:** `media_agent_prd.md`, `media_agent_tech_spec.md`

---

## 1. Design philosophy

### 1.1 Core principles

**Conversation is the interface, media is the canvas.** The user thinks in natural language. The agent thinks in workflows. The UI must bridge these two mental models without exposing the machinery. The chat is where intent is expressed and refined. The canvas is where results materialize and are manipulated.

**Show the work, not the wiring.** Users need to see what the agent is doing (progress, intermediate results, cost) but never how it's doing it (DAG nodes, provider names, adapter calls). Transparency about *progress* builds trust. Transparency about *implementation* creates anxiety.

**Media deserves space.** Generated images, videos, and audio are the product — not accessories to a text conversation. Every layout decision must privilege media display. Full-bleed previews. Large thumbnails. Inline playback. The UI should feel like a creative studio that happens to have a chat, not a chatbot that happens to show images.

**Progressive complexity.** A first-time user types a sentence and gets a result. A power user configures brand kits, edits workflow DAGs, and builds templates. Both users see the same interface — complexity reveals itself through interaction, never through modes or settings screens.

### 1.2 Aesthetic direction

**Studio minimal.** The interface is a tool for making things. It should feel like a clean workbench — warm neutrals, generous whitespace, no decoration. Media output is the only color. The UI recedes; the work advances.

Typography: one sans-serif family (two weights: regular and medium), monospaced for technical details only. No display fonts. The media *is* the display.

Color: near-white backgrounds, ink-dark text, one accent color (warm amber) for interactive elements and progress indicators. All other color comes from user-generated media. Dark mode is a first-class citizen — creative professionals work in dark environments.

Motion: purposeful only. Progress animations, smooth panel transitions, media loading states. No gratuitous hover effects, no bouncing, no parallax. The one exception: the moment a generated image appears should feel like a reveal — a quick fade-in from a blurred placeholder.

---

## 2. Information architecture

### 2.1 Top-level navigation

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]   Studio    Library    Brand kit    Templates    │
└──────────────────────────────────────────────────────────┘
```

Four spaces, each serving a distinct job:

| Space | Purpose | Primary action |
|-------|---------|---------------|
| **Studio** | Where work happens. Chat + canvas. One active workflow at a time. | Create, iterate, refine |
| **Library** | Browse all generated assets across all workflows. Grid view with filters and search. | Find, reuse, download |
| **Brand kit** | Configure brand assets: logo, colors, fonts, tone, guidelines. | Set up, maintain |
| **Templates** | Browse, create, and run saved workflow templates. | Automate, reuse |

The Studio is the default and primary view. Users spend 80%+ of their time here.

### 2.2 Studio layout — the split view

The Studio uses a **chat + canvas split layout**. This is the core interaction surface.

```
┌────────────────────────────────────────────────────────────────┐
│  Navigation bar                                                │
├──────────────────────────┬─────────────────────────────────────┤
│                          │                                     │
│       Chat panel         │         Canvas panel                │
│       (400px fixed)      │         (flexible, fills rest)      │
│                          │                                     │
│  Messages, input,        │  Media preview, workflow progress,  │
│  workflow plan,          │  variant grid, comparison view,     │
│  history                 │  interactive controls               │
│                          │                                     │
│                          │                                     │
│                          │                                     │
│                          │                                     │
│  ┌────────────────────┐  │                                     │
│  │  Input bar         │  │                                     │
│  │  [+ attach] [send] │  │                                     │
│  └────────────────────┘  │                                     │
├──────────────────────────┴─────────────────────────────────────┤
│  Status bar: workflow status · cost · elapsed time             │
└────────────────────────────────────────────────────────────────┘
```

**Why a split view, not a full-width chat?**

- Generated media needs horizontal space. A 1024×1024 image in a narrow chat column is 300px wide — too small to evaluate quality.
- Workflows produce multiple outputs. The canvas can show a variant grid, a before/after comparison, or a video timeline. These require dedicated space.
- The chat is for conversation. The canvas is for inspection. Separating them prevents the scroll-to-find-that-image problem that plagues single-column chat interfaces.

**Responsive behavior:**

| Viewport | Layout |
|----------|--------|
| ≥1280px | Side-by-side split. Chat: 400px fixed. Canvas: fills remaining width. |
| 1024–1279px | Side-by-side split. Chat: 360px. Canvas: fills rest. |
| 768–1023px | Stacked with toggle. Chat or canvas visible, swipe/tab to switch. Canvas slides over chat. |
| <768px (mobile) | Full-screen chat. Canvas appears as an overlay sheet when media is tapped. |

---

## 3. Chat panel

### 3.1 Message types

The chat is not just text bubbles. It contains structured message types:

#### User message
Standard text input. Can include attached files (drag-drop or button). Attachments show as compact chips below the text:

```
┌──────────────────────────────┐
│ Remove the background and    │
│ put it on a studio backdrop  │
│                              │
│  📎 product_photo.jpg  2.1MB │
└──────────────────────────────┘
```

#### Agent text response
Plain text from the orchestrator. Used for clarifying questions, confirmations, and conversational replies. Left-aligned, no bubble — just text with a subtle left border.

#### Plan card
When the agent proposes a multi-step workflow, it appears as a structured card:

```
┌─────────────────────────────────────┐
│  Plan: Product studio shot          │
│                                     │
│  1. Remove background               │
│  2. Generate studio backdrop         │
│  3. Overlay brand logo         ◻ CP │
│  4. Export: feed (1:1) + story (9:16)│
│                                     │
│  Est. cost: $0.13 · ~45 sec         │
│                                     │
│  [ Approve ]  [ Edit plan ]         │
└─────────────────────────────────────┘
```

The ◻ CP marker indicates a checkpoint — the workflow will pause here for approval. Users can toggle checkpoints on/off by clicking.

"Edit plan" expands the card into an editable list where users can reorder, remove, or add steps. This is the power-user escape hatch.

#### Progress card
During execution, replaces the plan card with live progress:

```
┌─────────────────────────────────────┐
│  Running: Product studio shot       │
│                                     │
│  ✓ Remove background        0.8s    │
│  ✓ Generate studio backdrop  6.2s   │
│  ● Overlay brand logo        ...    │
│  ○ Export variants                   │
│                                     │
│  ████████████░░░░░  62%             │
│  $0.09 spent · ~15 sec remaining    │
└─────────────────────────────────────┘
```

Each completed step shows a small thumbnail that, when clicked, loads that intermediate result into the canvas.

#### Checkpoint card
When execution hits a checkpoint:

```
┌─────────────────────────────────────┐
│  ⏸ Checkpoint: Review studio shot   │
│                                     │
│  The agent paused for your approval │
│  before adding the logo overlay.    │
│                                     │
│  [thumbnail of studio shot →]       │
│                                     │
│  [ Approve ]  [ Redo ] [ Give feedback ] │
└─────────────────────────────────────┘
```

The thumbnail is clickable → loads full preview in canvas.
"Give feedback" expands an inline text input ("Make the backdrop lighter and more minimal").

#### Media result card
Final output. Shows compact thumbnails in chat with a "View in canvas" action:

```
┌─────────────────────────────────────┐
│  ✓ Done — 2 variants                │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │ 1:1     │  │ 9:16    │          │
│  │ feed    │  │ story   │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  [ Download all ]  [ View in canvas ] │
└─────────────────────────────────────┘
```

### 3.2 Input bar

```
┌──────────────────────────────────────────┐
│  [+]  Type a message...          [Send]  │
└──────────────────────────────────────────┘
```

**[+] button** opens an attachment menu:
- Upload file (image, video, audio, document)
- Pick from library (opens a compact asset browser)
- Use camera (mobile)

**Slash commands** for power users. Typing `/` shows a dropdown:
- `/generate` — image/video/audio generation
- `/edit` — modify existing media
- `/template` — run a saved template
- `/brand` — apply/check brand kit
- `/validate` — run content validation

These are shortcuts — everything can also be expressed in natural language.

**Multiline input** expands the input bar vertically (up to 4 lines) as the user types. Shift+Enter for new line, Enter to send.

### 3.3 Chat history

Previous workflows appear as collapsible sections in the chat:

```
  ▾ Today
    ▸ Product studio shot (3 outputs) — 2 min ago
    ▸ Instagram Reel ad (1 output) — 1 hr ago
  ▸ Yesterday
  ▸ This week
```

Expanding a past workflow restores its messages and loads its outputs into the canvas.

---

## 4. Canvas panel

The canvas is the star. Its content changes based on context.

### 4.1 Canvas modes

The canvas has five modes, automatically selected based on what is being displayed. Users never manually switch modes — the agent and UI state determine which mode is active.

#### 4.1.1 Single media view

For viewing one image, video, or audio file. The media fills the canvas with proper aspect ratio.

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│          [Full-size media preview]           │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  Filename.png · 1024×1024 · 2.3 MB          │
│  [ Download ] [ Edit ] [ Use as input ]     │
└─────────────────────────────────────────────┘
```

**Image:** Displayed at native resolution up to canvas width. Scroll to zoom. Click-and-drag to pan when zoomed.

**Video:** Inline player with custom controls (play/pause, scrub, volume, fullscreen, playback speed). Waveform visualization for audio track.

**Audio:** Waveform visualization filling the canvas width. Play/pause, scrub, volume. If the audio is a voiceover, the transcript appears below the waveform with clickable timestamps.

**3D:** WebGL viewer (model-viewer component) with orbit controls, lighting presets, and background toggle.

#### 4.1.2 Variant grid

When a generation produces multiple variants (e.g., 4 image options). The grid adapts to variant count:

```
  2 variants → 2 columns, full height
  3 variants → 3 columns
  4 variants → 2×2 grid
  6 variants → 3×2 grid
  8 variants → 4×2 grid
```

Each cell is clickable → expands to single media view.

Interaction: **click to select.** Selected variant gets a subtle amber border. The user can then say "use this one" or "refine this one" in chat, and the agent knows which variant is selected.

#### 4.1.3 Comparison view

For before/after or side-by-side comparison. Two modes:

**Slider comparison:** A vertical divider the user drags left/right to reveal before (left) vs. after (right). The divider has a visible handle. Useful for: background removal, color correction, style transfer, upscaling.

**Side-by-side:** Two panels with synced zoom/pan. Useful for: comparing two variants, original vs. edited.

The agent auto-selects the appropriate comparison mode. Slider for same-composition edits. Side-by-side for different compositions.

#### 4.1.4 Timeline view

For video workflows. A horizontal timeline shows the video structure:

```
┌──────────────────────────────────────────────┐
│  [Video preview — large]                      │
│                                              │
├──────────────────────────────────────────────┤
│  Scene 1    │ Scene 2    │ Scene 3    │ Outro│
│  0:00–0:04  │ 0:04–0:09  │ 0:09–0:13 │0:13- │
├──────────────────────────────────────────────┤
│  🎵 Background music ░░░░░░░░░░░░░░░░░░░░░░ │
│  🎤 Voiceover ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────┘
```

Scenes are clickable → selects that scene for refinement ("regenerate scene 2 with warmer lighting"). Audio tracks are visualized as waveforms below the video strip.

#### 4.1.5 Workflow progress view

During multi-step execution, the canvas shows a **vertical stepper** with live previews appearing as each step completes:

```
┌──────────────────────────────────────────────┐
│                                              │
│  ✓ Step 1: Remove background                 │
│    ┌──────────────┐                          │
│    │ [thumbnail]  │  1024×1024 · 0.8s        │
│    └──────────────┘                          │
│                                              │
│  ✓ Step 2: Generate studio backdrop           │
│    ┌──────────────┐                          │
│    │ [thumbnail]  │  1024×1024 · 6.2s        │
│    └──────────────┘                          │
│                                              │
│  ● Step 3: Overlay brand logo                │
│    ┌──────────────┐                          │
│    │ [shimmer     │  Processing...           │
│    │  loading]    │                          │
│    └──────────────┘                          │
│                                              │
│  ○ Step 4: Export variants                    │
│                                              │
└──────────────────────────────────────────────┘
```

Thumbnails are clickable → expand to full single media view. This gives users visual confirmation of each step without requiring them to approve every one.

### 4.2 Canvas toolbar

A floating toolbar at the top of the canvas provides contextual actions:

```
┌────────────────────────────────────────────────────┐
│  ←  →  │ 🔍 100% │ Compare │ Download │ ⋯ More    │
└────────────────────────────────────────────────────┘
```

- **← →** Navigate between outputs in the current workflow.
- **🔍 100%** Zoom control (fit, 100%, 200%).
- **Compare** Toggle comparison view (only when two related outputs exist).
- **Download** Download current view (single file or zip for multi-variant).
- **⋯ More** — Copy link, send to library, use as input for new workflow, view metadata, open in new tab.

---

## 5. Key interaction patterns

### 5.1 The generation cycle

Every interaction follows this loop:

```
Express intent (chat)
      ↓
Review plan (plan card in chat)
      ↓
Watch progress (progress card + canvas stepper)
      ↓
Inspect result (canvas — single, grid, or timeline)
      ↓
Iterate or accept (chat — "make it warmer" or "download")
```

The key UX insight: **the chat drives, the canvas displays.** Users never click buttons on the canvas to trigger generation. They always express intent in the chat. The canvas is for inspection and selection.

The one exception: the variant grid. Clicking a variant in the grid is a selection action that sets context for the next chat message. "Use this one" or "refine this" without clicking would be ambiguous.

### 5.2 Iteration patterns

**Inline refinement.** User says "make the backdrop lighter" → agent re-runs only the affected step → canvas updates in-place with a smooth crossfade. No new workflow, no scroll-to-find.

**Branching.** User says "give me a version with blue CTA and one with orange CTA" → canvas switches to variant grid showing both. Each branch is selectable for further refinement.

**Rollback.** User says "go back to before I changed the font" → canvas animates back to the previous state. The version tree is maintained internally; users navigate it through conversation, not through a version history UI. (Power users can access an explicit version history via the ⋯ More menu.)

**Re-generation.** User says "try again" or "give me more options" → agent re-runs the last generation step with a different seed. New variants appear in the grid alongside existing ones.

### 5.3 Drag-and-drop

Users can drag files onto three drop targets:

| Target | Action |
|--------|--------|
| **Chat panel** | Attach file to the next message (input for a new workflow) |
| **Canvas — variant grid** | Add the dropped image as a new variant for comparison |
| **Canvas — single view** | Replace the current canvas content (triggers "edit this" intent) |

### 5.4 Multi-select and batch operations

In the variant grid, users can select multiple items (click with Shift/Cmd held):

- "Download selected" — zips and downloads.
- "Combine these" — triggers an editing workflow (e.g., "create a collage from these").
- "Export all for Instagram" — reformats all selected to target specs.

### 5.5 Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus input bar with slash command mode |
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `Cmd+D` | Download current canvas content |
| `Cmd+Z` | Undo last canvas action (rollback) |
| `←` `→` | Navigate between outputs |
| `Space` | Play/pause (video and audio) |
| `F` | Toggle fullscreen canvas |
| `G` | Toggle variant grid view |
| `C` | Toggle comparison view |
| `1-9` | Select variant N in grid view |
| `Esc` | Close overlay / exit fullscreen |

---

## 6. Brand kit interface

Accessible via the top navigation. A dedicated configuration space, not a modal.

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Brand kit                                    [ Save ]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Logo                                                   │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Primary logo │  │ Icon / mark  │  [ Upload ]         │
│  │  [preview]   │  │  [preview]   │                     │
│  └──────────────┘  └──────────────┘                     │
│  Placement rules: bottom-right, 10% width, 20px margin  │
│                                                         │
│  Colors                                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │
│  │████│ │████│ │████│ │████│ │████│  [ + Add ]          │
│  │Prim│ │Sec │ │Acc │ │Bg  │ │Text│                     │
│  └────┘ └────┘ └────┘ └────┘ └────┘                     │
│                                                         │
│  Typography                                             │
│  Heading: [ Instrument Serif  ▾ ]                       │
│  Body:    [ DM Sans           ▾ ]                       │
│  Preview: The quick brown fox...                        │
│                                                         │
│  Tone & style                                           │
│  ┌─────────────────────────────────────────┐            │
│  │ Describe your brand's visual style      │            │
│  │ and tone of voice. The agent will       │            │
│  │ reference this when generating content. │            │
│  │                                         │            │
│  │ "Modern, clean, warm. Avoid corporate   │            │
│  │  stock photo aesthetic. Prefer natural  │            │
│  │  lighting and earth tones..."           │            │
│  └─────────────────────────────────────────┘            │
│                                                         │
│  Content guidelines                                     │
│  ┌─────────────────────────────────────────┐            │
│  │ Rules the agent will enforce during     │            │
│  │ validation. One per line.               │            │
│  │                                         │            │
│  │ • Logo must appear on all public assets │            │
│  │ • Never use red as a background color   │            │
│  │ • CTA text must be ≤ 5 words            │            │
│  └─────────────────────────────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Interactions

- **Color swatches** are clickable → open a color picker with hex input.
- **Font selectors** show a live preview of the selected font in the preview area below.
- **Logo uploads** accept SVG, PNG, or PDF. The system auto-generates light/dark variants if not provided.
- **Tone & style** and **Content guidelines** are free-text fields. The agent receives these verbatim as part of its context when generating content.

### 6.3 Brand kit in action

When a brand kit is active, a small indicator appears in the Studio status bar:

```
  ◆ Brand kit active: "Lumen" · 5 colors · 2 fonts · logo ✓
```

Users can toggle brand kit on/off per workflow with a quick chat command: "ignore brand kit for this one."

---

## 7. Template library

### 7.1 Browse view

A grid of template cards, each showing:

```
┌─────────────────────────┐
│  [Preview thumbnail]    │
│                         │
│  Weekly social bundle   │
│  5 steps · 3 variants   │
│  Last used: 2 days ago  │
│                         │
│  [ Run ]  [ Edit ]      │
└─────────────────────────┘
```

Templates are filterable by category (product, social, ad, video), number of steps, and recency.

### 7.2 Run template flow

Clicking "Run" opens a **variable input form** in the Studio chat:

```
┌─────────────────────────────────────┐
│  Running template: Weekly social    │
│                                     │
│  Product image:  [ Upload or pick ] │
│  Headline:       [ _____________ ]  │
│  CTA text:       [ Shop now      ]  │
│  Platforms:      ☑ Feed  ☑ Story    │
│                  ☑ Reel  ☐ Banner   │
│                                     │
│  [ Start workflow ]                 │
└─────────────────────────────────────┘
```

After starting, the workflow executes in the Studio with normal progress/checkpoint/result flow.

### 7.3 Create template

Users can save any completed workflow as a template. A "Save as template" option appears in the ⋯ More menu of a completed workflow. The system auto-detects variable inputs (the uploaded image, the text strings) and lets the user name each variable.

---

## 8. Library

### 8.1 Grid layout

A masonry grid of generated assets. Each cell shows:

- Thumbnail (image/video first frame/audio waveform).
- File type badge (IMG, VID, AUD, 3D).
- Dimensions or duration.
- Date.

### 8.2 Filters and search

```
┌──────────────────────────────────────────────────────────┐
│  Search assets...                                        │
│                                                          │
│  Type: [ All ▾ ]  Date: [ This month ▾ ]  Tags: [ + ]   │
│                                                          │
│  Sort by: [ Newest ▾ ]          View: [Grid] [List]      │
└──────────────────────────────────────────────────────────┘
```

Semantic search: users can type "product photos with white background" and get results ranked by relevance, not just tag matching.

### 8.3 Asset detail

Clicking an asset opens a detail panel (slide-over from right):

- Full-size preview.
- Metadata: resolution, format, file size, date, cost to generate.
- Provenance: which workflow produced it, which step, what prompt was used.
- Tags (editable).
- Actions: download, use as input for new workflow, delete.

---

## 9. Design system

### 9.1 Design tokens

#### Color tokens

```
/* Neutral palette */
--lumen-white:           #FAFAF8;
--lumen-gray-50:         #F5F5F0;
--lumen-gray-100:        #EAEAE4;
--lumen-gray-200:        #D5D5CC;
--lumen-gray-300:        #B8B8AE;
--lumen-gray-400:        #8E8E85;
--lumen-gray-500:        #6B6B63;
--lumen-gray-600:        #4A4A44;
--lumen-gray-700:        #333330;
--lumen-gray-800:        #1E1E1C;
--lumen-gray-900:        #121211;

/* Accent */
--lumen-amber-400:       #E8A230;
--lumen-amber-500:       #D4912A;
--lumen-amber-600:       #B87A1F;

/* Semantic */
--lumen-success:         #3D9A5F;
--lumen-error:           #C94444;
--lumen-info:            #4A8FCC;
--lumen-warning:         #D4912A;

/* Surfaces (light mode) */
--surface-primary:       var(--lumen-white);
--surface-secondary:     var(--lumen-gray-50);
--surface-elevated:      #FFFFFF;
--surface-overlay:       rgba(18, 18, 17, 0.6);

/* Surfaces (dark mode) */
--surface-primary-dark:  var(--lumen-gray-900);
--surface-secondary-dark:var(--lumen-gray-800);
--surface-elevated-dark: var(--lumen-gray-700);
--surface-overlay-dark:  rgba(0, 0, 0, 0.7);

/* Text (light mode) */
--text-primary:          var(--lumen-gray-900);
--text-secondary:        var(--lumen-gray-500);
--text-tertiary:         var(--lumen-gray-400);
--text-inverse:          var(--lumen-white);

/* Text (dark mode) */
--text-primary-dark:     var(--lumen-gray-50);
--text-secondary-dark:   var(--lumen-gray-400);
--text-tertiary-dark:    var(--lumen-gray-500);

/* Borders */
--border-default:        var(--lumen-gray-200);
--border-subtle:         var(--lumen-gray-100);
--border-strong:         var(--lumen-gray-300);
--border-interactive:    var(--lumen-amber-500);
```

#### Typography tokens

```
/* Font family */
--font-sans:             "DM Sans", -apple-system, sans-serif;
--font-mono:             "JetBrains Mono", monospace;

/* Font sizes — modular scale (1.2 ratio) */
--text-xs:               11px;    /* metadata, timestamps */
--text-sm:               13px;    /* secondary text, labels */
--text-base:             15px;    /* body text, chat messages */
--text-md:               18px;    /* section headers */
--text-lg:               22px;    /* page titles */
--text-xl:               28px;    /* hero / empty states */

/* Font weights */
--weight-regular:        400;
--weight-medium:         500;

/* Line heights */
--leading-tight:         1.3;
--leading-normal:        1.55;
--leading-relaxed:       1.7;
```

#### Spacing tokens

```
/* Base unit: 4px */
--space-1:   4px;
--space-2:   8px;
--space-3:   12px;
--space-4:   16px;
--space-5:   20px;
--space-6:   24px;
--space-8:   32px;
--space-10:  40px;
--space-12:  48px;
--space-16:  64px;
```

#### Radius tokens

```
--radius-sm:   4px;     /* small elements: badges, chips */
--radius-md:   8px;     /* buttons, inputs, cards */
--radius-lg:   12px;    /* panels, modals */
--radius-xl:   16px;    /* large containers */
--radius-full: 9999px;  /* pills, avatars */
```

#### Shadow tokens

```
/* Shadows are minimal — only for elevated surfaces */
--shadow-sm:   0 1px 2px rgba(0,0,0,0.04);
--shadow-md:   0 2px 8px rgba(0,0,0,0.06);
--shadow-lg:   0 4px 16px rgba(0,0,0,0.08);
```

#### Motion tokens

```
--duration-fast:    120ms;   /* micro-interactions: hover, focus */
--duration-normal:  200ms;   /* panel transitions, fades */
--duration-slow:    400ms;   /* media reveals, layout shifts */

--ease-default:     cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);    /* bouncy, for reveals */
--ease-decelerate:  cubic-bezier(0, 0, 0.2, 1);            /* entering elements */
```

### 9.2 Component library

#### Buttons

Three tiers:

| Tier | Usage | Style |
|------|-------|-------|
| **Primary** | One per screen. Main action (Approve, Send, Download). | Amber background, dark text, medium weight. |
| **Secondary** | Supporting actions (Edit plan, View in canvas). | Transparent background, subtle border, default text. |
| **Ghost** | Tertiary actions (⋯ More, Close). | No border, no background. Text only. Hover: subtle background. |

All buttons: `height: 36px`, `padding: 0 16px`, `border-radius: var(--radius-md)`, `font-size: var(--text-sm)`, `font-weight: var(--weight-medium)`.

#### Cards

Used for plan cards, progress cards, checkpoint cards, media result cards, template cards.

```css
.card {
  background: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}
```

Interactive cards (template cards, variant cells) get a hover state:

```css
.card-interactive:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-fast) var(--ease-default);
}
```

#### Media thumbnail

A reusable component for displaying media previews at any size.

```css
.media-thumb {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--lumen-gray-100);  /* placeholder color */
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-decelerate);
}

.media-thumb img.loaded {
  opacity: 1;
}

/* Type badge */
.media-thumb .badge {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: rgba(0,0,0,0.6);
  color: white;
  backdrop-filter: blur(4px);
}

/* Duration (for video/audio) */
.media-thumb .duration {
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-2);
  /* same style as badge */
}
```

#### Loading / shimmer state

Used when media is being generated. A CSS-only shimmer animation:

```css
.shimmer {
  background: linear-gradient(
    110deg,
    var(--lumen-gray-100) 30%,
    var(--lumen-gray-50) 50%,
    var(--lumen-gray-100) 70%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  to { background-position: -200% 0; }
}
```

In dark mode, shimmer uses `gray-800` → `gray-700` → `gray-800`.

#### Progress bar

```css
.progress-bar {
  height: 4px;
  background: var(--lumen-gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar .fill {
  height: 100%;
  background: var(--lumen-amber-500);
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-default);
}
```

#### Step indicator

Used in plan cards and progress cards:

```
✓  Completed step     — green circle, text at normal opacity
●  Active step        — amber pulsing dot, text at full opacity
○  Pending step       — gray hollow circle, text at reduced opacity
⏸  Checkpoint step   — amber pause icon, text at full opacity
✕  Failed step        — red circle, text with error styling
```

#### Comparison slider

A custom component for before/after comparisons:

- Vertical divider line: 2px, amber.
- Circular handle on the divider: 32px diameter, white, subtle shadow.
- Before/after labels: positioned at top-left and top-right of each side.
- The divider is draggable. On mouse/touch move, the clip-path of the "after" image updates.

#### Video player

Custom controls over a native `<video>` element:

- Control bar fades in on hover, auto-hides after 3 seconds.
- Scrub bar: thin (4px) expanding to 8px on hover. Amber fill for played portion.
- Play/pause: center of video on first load, moves to control bar on play.
- Time display: `0:00 / 0:15` in mono font.
- No chrome, no default browser controls.

---

## 10. Media display guidelines

### 10.1 Image rendering rules

| Scenario | Display rule |
|----------|-------------|
| Image ≤ canvas width | Display at native resolution, centered |
| Image > canvas width | Scale to fit width, maintain aspect ratio |
| Very tall image (>2:1 ratio) | Scale to fit height, horizontally centered |
| Very wide image (>3:1 ratio) | Scale to fit width, scrollable if taller |
| Transparent background (RGBA) | Render over a checkerboard pattern (standard in image tools) |

### 10.2 Video rendering rules

- Auto-play on load, muted. First play after user interaction can unmute.
- Loop videos under 10 seconds by default.
- Show first frame as poster while loading.

### 10.3 Audio rendering rules

- Never auto-play audio.
- Show waveform visualization (pre-computed on server, rendered as SVG path).
- If transcript exists, show it as a scrollable text panel synced to playback position.

### 10.4 Loading states

Every media generation goes through three visual states:

1. **Queued:** Shimmer placeholder at the expected output dimensions (or default 1:1 if unknown).
2. **Generating:** Shimmer continues. If the provider supports streaming preview, a blurry low-res preview fades in over the shimmer.
3. **Complete:** The final image/video fades in with a quick scale-up (1.02 → 1.0 over 300ms with `ease-spring`). This "reveal" moment is the most satisfying micro-interaction in the UI.

### 10.5 Error states

If generation fails:

```
┌──────────────────────────────────────┐
│                                      │
│       ◌                              │
│  Generation failed                   │
│  "The image model returned an error" │
│                                      │
│  [ Retry ]  [ Try different model ]  │
│                                      │
└──────────────────────────────────────┘
```

Muted styling. No red. No alarms. Just a clear explanation and recovery options.

---

## 11. Empty states and onboarding

### 11.1 First-time Studio

When a new user opens the Studio, the canvas shows a warm welcome with example prompts:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│               What do you want to create?                │
│                                                          │
│    ┌──────────────────────────────────────────┐          │
│    │  "Generate a product photo of wireless   │          │
│    │   headphones on a marble surface"        │          │
│    └──────────────────────────────────────────┘          │
│    ┌──────────────────────────────────────────┐          │
│    │  "Make a 15-second Instagram Reel ad     │          │
│    │   for my coffee brand"                   │          │
│    └──────────────────────────────────────────┘          │
│    ┌──────────────────────────────────────────┐          │
│    │  "Remove the background from this photo  │          │
│    │   and put it on a gradient backdrop"     │          │
│    └──────────────────────────────────────────┘          │
│                                                          │
│    These are tappable — clicking one pre-fills the input │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 11.2 Empty library

```
  Your library is empty.
  Generated assets will appear here
  as you create them in the Studio.

  [ Go to Studio ]
```

### 11.3 Empty brand kit

```
  No brand kit configured.
  Add your logo, colors, and fonts
  to maintain consistency across
  all generated content.

  [ Set up brand kit ]
```

---

## 12. Mobile design

### 12.1 Core adaptations

On mobile (<768px), the split view collapses to a **tabbed full-screen** layout:

```
┌──────────────────────┐
│  [Chat]    [Canvas]  │  ← tab bar
├──────────────────────┤
│                      │
│  Full-screen content │
│  (chat or canvas,    │
│   based on active    │
│   tab)               │
│                      │
│                      │
│                      │
├──────────────────────┤
│  [ Input bar ]       │
└──────────────────────┘
```

The input bar is always visible regardless of active tab. Users can type while viewing the canvas.

**Auto-switch behavior:** When the agent produces media output, the app automatically switches to the Canvas tab with a brief transition. When the agent asks a question or reaches a checkpoint, it switches to the Chat tab.

### 12.2 Gestures

| Gesture | Action |
|---------|--------|
| Swipe left/right | Switch between Chat and Canvas tabs |
| Pinch to zoom | Zoom on canvas media |
| Double tap | Toggle between fit-to-screen and 100% zoom |
| Long press on variant | Select for comparison |
| Pull down on canvas | Show toolbar |

### 12.3 Media display on mobile

- Variant grids: single column, vertical scroll (no 2×2 grid — too small).
- Video player: full-width, controls always visible (no hover state on touch).
- Comparison slider: works with touch drag. Handle is larger (44px) for thumb targeting.
- Timeline view: horizontal scroll with momentum. Scenes are wider (min 120px).

---

## 13. Accessibility

### 13.1 Requirements

- All interactive elements are keyboard accessible.
- Focus management: when canvas content updates, focus moves to the new content (with `aria-live` for screen readers).
- All media has alt text (auto-generated via the captioning primitive if not provided by the user).
- Video player has captions (auto-generated via STT if not provided).
- Color contrast: all text meets WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text).
- Amber accent on white: the amber-500 (`#D4912A`) on white (`#FAFAF8`) has a contrast ratio of 3.2:1. This is used only for large text/icons, never for body text. For body text on amber backgrounds, use `gray-900`.
- Reduced motion: all animations respect `prefers-reduced-motion: reduce`. Shimmer, reveals, and transitions become instant.
- Screen reader announcements for: workflow started, step completed, checkpoint waiting, workflow complete, error.

### 13.2 Aria patterns

```html
<!-- Variant grid -->
<div role="radiogroup" aria-label="Generated variants">
  <div role="radio" aria-checked="true" tabindex="0">Variant 1</div>
  <div role="radio" aria-checked="false" tabindex="-1">Variant 2</div>
</div>

<!-- Progress updates -->
<div aria-live="polite" aria-atomic="false">
  Step 2 of 4 completed: Generate studio backdrop
</div>

<!-- Checkpoint -->
<div role="alertdialog" aria-label="Approval required">
  The agent paused for your review.
</div>
```

---

## 14. Micro-interactions reference

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Media reveal (generation complete) | Fade in + scale 1.02→1.0 | 300ms | ease-spring |
| Plan card expand (edit mode) | Height auto-animate | 200ms | ease-default |
| Step completion (✓ appears) | Scale 0→1 + checkmark draw | 250ms | ease-spring |
| Canvas mode transition | Crossfade | 200ms | ease-default |
| Variant selection border | Border-color transition | 120ms | ease-default |
| Shimmer loading | Background position loop | 1500ms | linear |
| Progress bar fill | Width transition | 200ms | ease-default |
| Chat message appear | Fade in + translate-y 8→0 | 200ms | ease-decelerate |
| Comparison slider drag | Clip-path update | 0ms (realtime) | — |
| Error state appear | Fade in | 200ms | ease-default |
| Tab switch (mobile) | Translate-x + opacity | 200ms | ease-default |
| Toolbar auto-hide | Opacity + translate-y | 300ms | ease-default |

---

## 15. Figma structure (recommended)

### 15.1 File organization

```
Lumen Design System (library file)
├── Tokens (color, type, spacing, radius, shadow, motion)
├── Components
│   ├── Buttons (primary, secondary, ghost × states)
│   ├── Cards (plan, progress, checkpoint, result, template)
│   ├── Media (thumbnail, player, waveform, shimmer, error)
│   ├── Chat (user message, agent message, input bar)
│   ├── Navigation (top bar, tab bar, status bar)
│   ├── Controls (slider, dropdown, toggle, checkbox, radio)
│   ├── Feedback (progress bar, step indicator, toast)
│   └── Layout (split view, variant grid, comparison, timeline)
└── Patterns
    ├── Generation cycle (plan → progress → result)
    ├── Checkpoint flow
    ├── Variant selection
    ├── Brand kit setup
    └── Template run

Lumen Product (design file)
├── Studio (desktop, tablet, mobile)
├── Library (desktop, mobile)
├── Brand kit (desktop)
├── Templates (desktop, mobile)
└── Onboarding (first-run flows)
```

### 15.2 Prototyping priorities

Build interactive prototypes (Figma prototype or code) for these flows first — they contain the most design risk:

1. **Generation cycle** (plan → progress → result → iterate). This is 80% of usage. Get it right.
2. **Checkpoint approval.** The pause-and-approve interaction is novel. Users need to understand instantly what's happening and what they can do.
3. **Variant grid → selection → refinement.** The bridge between canvas selection and chat refinement is the trickiest interaction.
4. **Mobile tab switching.** The auto-switch between Chat and Canvas tabs could feel jarring. Prototype and test.
5. **Comparison slider.** Must feel native and responsive, especially on touch.

---

## Appendix A — Competitive UI reference

| Product | What to learn | What to avoid |
|---------|--------------|---------------|
| **Midjourney (web)** | The variant grid UX. The "upscale / variation" actions on each variant. The gallery-first layout. | The Discord-legacy UX. Tiny thumbnails. No inline editing. |
| **Runway** | The timeline editor for video. The "gen-1/gen-2" model selector. The canvas-first approach. | Complexity for simple tasks. Modal overload. |
| **Figma** | The inspector panel (right side) for properties. The command palette (`Cmd+/`). The multiplayer cursors. | The learning curve. Not relevant for conversational interfaces. |
| **Linear** | The speed. The keyboard-first interaction. The command palette. The restrained visual design. | The density — our media content needs more breathing room. |
| **Notion AI** | The inline AI interaction within existing content. The slash command menu. | The "AI block" that feels separate from the content. We want seamless integration. |
| **Descript** | The transcript-driven video editing. The side-by-side transcript + timeline. | The complexity of the full editing suite. We're an agent, not an NLE. |

## Appendix B — Design principles quick reference (for the team wall)

```
1. Conversation drives, canvas displays.
2. Media is the product. Give it space.
3. Show progress, not plumbing.
4. Complexity reveals itself. Never all at once.
5. Every generation is a reveal moment. Make it feel good.
6. When in doubt, recede. Let the user's work be the loudest thing on screen.
```