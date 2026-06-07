What you're describing is less a "single agent" and more a **media production operating system**: an orchestration layer that can reason about creative intent, generate intermediate assets, maintain consistency, and compose final deliverables.

The biggest mistake most people make is building a prompt → tool loop.

What you actually want is:

**Goal → Plan → Asset Graph → Generation → Review → Refinement → Assembly**

---

# 1. Core Architecture

```text
┌──────────────────────────────┐
│ User Goal                    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Creative Director Agent      │
│ Planning & Decomposition     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Asset Graph Builder          │
│ Dependencies & Reuse         │
└──────────────┬───────────────┘
               │
     ┌─────────┼───────────┐
     ▼         ▼           ▼

Character  Environment   Props
Generator   Generator     Generator

     ▼         ▼           ▼

Reference Asset Registry

     ▼

Image Generator
Video Generator
Music Generator
Voice Generator

     ▼

Quality Review Agent

     ▼

Editor / Composer Agent

     ▼

Final Deliverable
```

---

# 2. Agent Roles

Instead of one giant agent:

## Creative Director

Responsible for:

- understanding intent
- planning
- story creation
- style interpretation
- deciding workflow

Example:

User:

> Create a short film about a dragon defending a city.

Creative director outputs:

```yaml
project:
    type: cinematic_short

characters:
    - dragon
    - child

scenes:
    - intro
    - attack
    - confrontation
    - resolution

assets_needed:
    - dragon_sheet
    - city_sheet
    - prop_sheet
    - soundtrack
    - narration
```

No media generation yet.

---

## Asset Planner

Creates dependency graph.

Example:

```text
Dragon Sheet
  └─ Scene 1 image
      └─ Scene 1 video

City Sheet
  └─ Scene 1 image
      └─ Scene 1 video

Scene videos
  └─ Final edit
```

This is critical.

Otherwise every scene drifts.

---

## Prompt Engineer Agent

Generates prompts optimized for specific generators.

Example:

User style:

```text
Pixar style
```

Prompt Engineer converts into:

```yaml
subject: dragon

camera: low angle

lighting: sunset

style: family animation

consistency: dragon_sheet_v3
```

Different prompts for:

- image models
- video models
- music models
- speech models

---

## Reviewer Agent

Evaluates generated assets.

Checks:

- style consistency
- identity consistency
- prompt adherence
- quality score

Example:

```yaml
dragon_identity:
    score: 0.45
    fail: true

reason: horns missing
```

Triggers regeneration.

---

## Editor Agent

Responsible for:

- sequencing
- transitions
- audio sync
- captions
- final rendering

---

# 3. Asset Registry

This becomes the heart of the system.

Every generated asset gets metadata.

Example:

```yaml
asset_id: dragon_sheet_v3

type: character_sheet

contains:
    - dragon

style: pixar

created_from: prompt_212

used_by:
    - scene1
    - scene2
    - scene3
```

Think:

```text
Git for media assets
```

Without this, long projects become impossible.

---

# 4. Project State

The agent needs persistent state.

Example:

```yaml
project:

goal: 60 second short film

style: anime

characters:

hero:
    asset: hero_sheet_v4

villain:
    asset: villain_sheet_v2

scenes:
    scene1:
        image: img_22
        video: vid_18

    scene2:
        image: img_23
        video: vid_19
```

Every decision references state.

---

# 5. Skills

Think of skills as reusable workflows.

---

## Skill: Character Creation

Input:

```yaml
description: female knight
```

Output:

```yaml
character_sheet
headshots
expressions
turnaround
```

---

## Skill: Story Creation

Input:

```yaml
theme: friendship
```

Output:

```yaml
synopsis
acts
scenes
```

---

## Skill: Image Consistency

Input:

```yaml
reference: hero_sheet
scene: battle
```

Output:

```yaml
consistent_image
```

---

## Skill: Image → Video

Input:

```yaml
image
motion_description
```

Output:

```yaml
video
```

---

## Skill: Video Assembly

Input:

```yaml
scene_videos[]
music
voiceover
```

Output:

```yaml
final_movie
```

---

# 6. Dynamic Prompt Construction

Never expose raw prompts as the primary abstraction.

Create prompt layers.

```yaml
prompt:

subject: dragon

style: pixar

camera: wide shot

motion: flying

lighting: sunset

quality: cinematic

negative: blur
    artifacts
```

Then render provider-specific prompts.

---

Example:

## Imagen

```text
...
```

## Flux

```text
...
```

## Veo

```text
...
```

## Kling

```text
...
```

Different renderers.

Same semantic representation.

---

# 7. User Approval Loop

I strongly recommend:

```text
PLAN
↓
APPROVE
↓
GENERATE
↓
APPROVE
↓
EDIT
↓
RENDER
```

instead of:

```text
generate immediately
```

For expensive workflows.

---

Example:

User:

> Create a 2 minute short movie

Agent:

```text
Here's the plan.

Characters:
...

Scenes:
...

Visual style:
...

Estimated cost:
...

Proceed?
```

Then generation starts.

---

# 8. Media-Specific Best Practices Knowledge

Your system prompt should contain guidance.

Example:

### Image Generation

```yaml
prefer: character sheets first

avoid: generating scenes before references
```

---

### Video Generation

```yaml
prefer:
  short clips

duration:
  5-10s

compose later
```

---

### Storytelling

```yaml
prefer: scene breakdown

avoid: generating 60s video in one shot
```

---

### Music

```yaml
generate: stems

not: final mix
```

---

# 9. Example Workflow: Story Creation

User:

> Create a story about a pirate cat.

Agent internally:

### Step 1

Story skill

```yaml
synopsis
characters
scenes
```

### Step 2

Character skill

```yaml
cat_sheet
ship_sheet
```

### Step 3

Scene image skill

```yaml
scene_1_image
scene_2_image
...
```

### Step 4

Image → video skill

```yaml
scene_1_video
scene_2_video
...
```

### Step 5

Voice skill

```yaml
narration
```

### Step 6

Music skill

```yaml
soundtrack
```

### Step 7

Editor skill

```yaml
final_movie.mp4
```

---

# 10. Example Workflow: Virtual Try-On

User:

> Put this outfit on this person and create a fashion reel.

Pipeline:

```text
Person Image
+
Garment Images
        │
        ▼

Virtual Try-On Skill

        ▼

Look Images

        ▼

Fashion Motion Planner

        ▼

Runway Video Generation

        ▼

Music

        ▼

Final Reel
```

---

# 11. Example Workflow: Product 360°

Pipeline:

```text
Reference Images

        ▼

3D Reconstruction Skill

        ▼

Canonical Product Representation

        ▼

Camera Orbit Planner

        ▼

Video Generator

        ▼

360 Video
```

The important insight is that the agent should not think in terms of "generate image" or "generate video."

It should think in terms of an **Asset Graph**:

```text
Goal
 ├─ Story
 ├─ Characters
 │   └─ Character Sheets
 ├─ Props
 ├─ Environments
 ├─ Scene Images
 ├─ Scene Videos
 ├─ Narration
 ├─ Music
 └─ Final Edit
```

The harness then becomes a workflow engine where specialized agents operate on nodes of the graph, and every generated artifact is registered, versioned, reviewed, and reused. This architecture scales from "generate two images and animate them" all the way to "produce a 10-minute animated short film with consistent characters and audio."
