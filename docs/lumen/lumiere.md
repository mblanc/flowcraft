# Media agent architecture

## Layer 0 — Primitives (atomic)

Single-step operations. Each wraps one model call or processing function.

### Generate

- **text → image** — Gemini 3.1 Image generation
- **text → video** — Veo video generation
- **image → video** — Animate a static image into video (Veo)
- **text → music** — Lyria music/soundtrack generation
- **text → SFX** — AudioFX sound effects generation
- **text → speech (TTS)** — Gemini 3 TTS synthesis
- **text → 3D asset** *(to add)* — Generate 3D mesh/model from text
- **image → 3D asset** *(to add)* — Reconstruct 3D from reference images

### Understand

- **Image captioning** — Describe image content in natural language
- **Video scene detection** — Identify scene boundaries and transitions
- **Object detection** — Locate and classify objects in images/video
- **Segmentation** — Pixel-level masks for objects, people, backgrounds
- **Face detection** — Detect faces and facial landmarks
- **Pose estimation** — Estimate body pose / skeleton keypoints
- **Depth estimation** — Predict depth map from 2D image
- **OCR** — Extract text from images/video frames
- **Speech → text (STT)** — Transcribe audio to text
- **Style / aesthetic scoring** — Score visual quality and aesthetic appeal
- **Content classification (NSFW, brand)** *(to add)* — Classify content against safety and brand categories
- **Audio source separation** *(to add)* — Isolate vocals, instruments, noise from mixed audio

### Edit / transform

- **Inpaint / outpaint** — Fill in or extend regions of an image
- **Background removal** — Remove or replace image background
- **Upscale / super-resolution** — Increase resolution with detail hallucination
- **Style transfer** — Apply the style of one image to another
- **Color correction** — Adjust white balance, exposure, grading
- **Video trim / cut / merge** — Basic non-linear video editing
- **Transitions & effects** — Add wipes, fades, motion effects between clips
- **Frame interpolation** — Generate intermediate frames for slow motion
- **Video stabilization** — Remove camera shake from footage
- **Audio mix / EQ / denoise** — Mix tracks, equalize, remove noise
- **Text / graphic overlay** — Render text, logos, CTAs on top of media
- **Subtitle rendering** — Burn or embed subtitles into video
- **Lip sync** *(to add)* — Synchronize mouth movements to audio
- **Face swap** *(to add)* — Replace one face with another
- **Motion tracking** *(to add)* — Track object movement across frames
- **Format conversion** — Transcode between media formats and aspect ratios
- **Watermark** — Add visible or invisible watermark to media

### Infrastructure

- **Brand kit** — Store and retrieve fonts, colors, logos, tone guidelines
- **Template engine** — Parameterized layouts for repeatable generation
- **Asset library / search** — Store, tag, and retrieve generated assets
- **Policy rules engine** — Define and evaluate content rules and constraints
- **Version history** *(to add)* — Track iterations and enable rollback
- **Render queue** *(to add)* — Manage async long-running jobs with priority

---

## Layer 1 — Composed workflows (orchestrated)

DAGs of primitives. Each is a recipe the agent plans and executes.

### Product & e-commerce

| Workflow | Primitive chain |
|----------|----------------|
| **Virtual try-on** | pose estimation → segmentation → inpaint (garment onto body) |
| **360° product spin** | ref images → depth estimation → novel view gen → image→video → stitch |
| **Product photography** | background removal → studio bg gen → color correction → upscale |
| **Virtual staging** | segmentation (room) → inpaint (furniture) → style transfer → upscale |
| **3D product viewer** | image → 3D asset → render turntable → format conversion |

### Advertising & marketing

| Workflow | Primitive chain |
|----------|----------------|
| **Ad image/video + overlays** | text→image/video → brand kit → text overlay (CTA, logo) → format variants |
| **A/B variant generation** | template engine → text→image × N → text overlay variants → aesthetic scoring |
| **Localized ad pipeline** | ad image → OCR → translate → text overlay (localized) → format conversion |
| **Dynamic banner suite** | template engine → text→image → text overlay → resize × formats (stories, feed, banner) |
| **Influencer content kit** | brand kit → text→image → face swap (model) → text overlay → multi-format |

### Long-form production

| Workflow | Primitive chain |
|----------|----------------|
| **End-to-end movie** | synopsis → storyboard (text→image) → TTS (dialogue) → image→video (rushes) → video edit → music gen → audio mix → subtitle render |
| **Animated explainer** | script → scene breakdown → text→image per scene → image→video → TTS → transitions → audio mix |
| **Podcast production** | TTS (multi-voice) → music gen (intro/outro) → audio mix → STT → subtitle render |
| **Music video** | music gen → scene detection → text→image per scene → image→video → video edit → audio mix |
| **Documentary assembly** | STT (interviews) → scene detection → video trim → text overlay → transitions → audio mix |
| **Webapp video overview** | screenshots → motion tracking (scroll sim) → transitions → TTS (narration) → music gen → audio mix |

### Social & short-form

| Workflow | Primitive chain |
|----------|----------------|
| **Multi-platform export** | source video → format conversion × (9:16, 1:1, 16:9) → subtitle render → watermark |
| **Meme / GIF generator** | text→image → text overlay → frame interpolation → format conversion (GIF) |
| **Thumbnail generator** | video scene detection → frame extract → text overlay → aesthetic scoring → upscale |
| **Avatar / character creator** | text→image (character sheet) → face detection → style transfer → multi-pose gen |
| **Before / after** | image × 2 → alignment → transition (wipe/slider) → text overlay |
| **Lip-synced talking head** | text→image (face) → TTS → lip sync → image→video |

### Quality & compliance

| Workflow | Primitive chain |
|----------|----------------|
| **Policy / guideline validation** | content classification → brand kit (guidelines) → policy rules engine → scoring report |
| **Accessibility audit** | OCR → color correction analysis → contrast check → alt-text gen (captioning) → report |
| **Brand consistency check** | object detection (logo) → color extraction → brand kit comparison → scoring |
| **Content moderation** | content classification (NSFW) → face detection → policy rules engine → flag/approve |
| **Quality assurance** | aesthetic scoring → upscale check → format validation → metadata verification |

---

## Agent design

### Planner → Executor → Reviewer

```
User intent (natural language)
        │
        ▼
   ┌─────────┐
   │ Planner  │  Classify intent → select workflow template or compose novel DAG
   └────┬────┘  from primitive catalog. Fill parameters (model, resolution, brand kit).
        │
        ▼
   ┌─────────┐
   │ Executor │  Run DAG nodes. Parallelize independent branches.
   └────┬────┘  Stream intermediate results back to user.
        │
        ▼
   ┌─────────┐
   │ Reviewer │  Validate output against constraints (policy, brand, quality).
   └────┬────┘  Loop back to executor with corrections if needed.
        │
        ▼
   Final output
```

### Key design decisions

- **Typed I/O between primitives**: every primitive declares input/output types (image, video, audio, mask, text, 3D mesh, metadata). The planner uses these types to verify DAG validity before execution.
- **Novel composition**: the planner can compose *new* workflows by reasoning over the primitive catalog, not just selecting from templates. This is where the Gemini 3.1 backbone earns its keep.
- **Streaming intermediates**: long workflows (movie pipeline) should surface intermediate results (storyboard frames, rough cuts) for user feedback before continuing.
- **Branching and parallelism**: independent branches in the DAG run concurrently. For example in ad generation, image gen and music gen can happen in parallel before the final compositing step.
- **Retry with alternatives**: if a primitive fails or scores poorly (aesthetic scoring below threshold), the executor can retry with different parameters or a different model.
- **Human-in-the-loop checkpoints**: configurable gates where the workflow pauses for user approval before proceeding (e.g., approve storyboard before generating rushes).