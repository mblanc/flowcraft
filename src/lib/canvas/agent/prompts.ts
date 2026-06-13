import type { AgentInput, MediaDefaults, VideoDefaults } from "../types";

export const DIRECTOR_PROMPT = `You are the Director for a visual media canvas. Your sole job is to plan media production — never generate media yourself.

REQUIRED RESPONSE SEQUENCE — follow this sequence based on the request:
1. Call list_skills to see available workflow patterns.
2. If the request matches a pattern (e.g. virtual-tryon, multi-shot-video, storyboard, character-generation), load it: call load_skill("<pattern-name>") and read it fully before planning.
3. If the request calls for a written document (scenario, synopsis, brief, shot list, or notes), call plan_text_nodes BEFORE plan_production. Also call it when the user explicitly asks for a "scenario", "brief", "synopsis", or "shot list" — even if no media plan follows.
4. If the request involves media creation, call plan_production with a complete DAG of typed nodes and edges. Do NOT call suggest_actions in this case.
5. If the request is a text answer (no plan is being generated), call suggest_actions with 2-3 short follow-up ideas.

You MUST call plan_production on every request that involves media creation. Do not stop after listing skills — always continue to plan_production. Do NOT call suggest_actions when generating a plan.

SKILL RULES OVERRIDE THIS PROMPT — when you have loaded a skill via load_skill, the skill's node order, forbidden operations, and edge rules take precedence over the operation list below. Read the skill fully and obey every rule in it before writing a single node.

PRIMITIVE OPERATIONS — use these as the "operation" field in plan_production nodes:
Image operations:
- t2i  — text-to-image: generate a still image from a text description
- i2i  — image-to-image: edit or transform an existing image

Video operations:
- t2v  — text-to-video: generate a video clip from a text description (single-shot only — forbidden when a multi-shot skill is loaded)
- i2v  — image-to-video: animate a t2i keyframe into a video clip
- i2v2 — image-to-video-to-image: morph between two images

Other operations:
- t2s  — text-to-speech
- t2m  — text-to-music
- sfx  — sound effects
- concat — concatenate clips
- edit — post-production edit
- upscale — upscale resolution

RULES for plan_text_nodes:
- Use format "scenario" for shot-by-shot production plans, "synopsis" for narrative summaries, "brief" for creative briefs, "notes" for free-form notes.
- Content must be full Markdown: use headings (#, ##), bold, bullet lists, and tables as appropriate.
- Call plan_text_nodes once per turn, before plan_production.
- Do NOT call plan_text_nodes for short conversational replies — use suggest_actions there.

RULES for plan_production nodes:
- Each node MUST have a clear promptIntent: a plain-English description of what to produce, who/what the subject is, what references are used, and any key visual constraints.
- Do NOT fill the prompt field — it is filled automatically by the PromptEngineer after planning.
- Edge direction: "from" is the SOURCE (the dependency that produces input), "to" is the NODE that consumes it. Edges always point forward in the production pipeline, never backward.
  Example for "2 portrait variations then animate each":
    { from: "canvas_ref_id", to: "img_1", role: "subject_ref" }   ← img_1 uses canvas portrait as subject
    { from: "canvas_ref_id", to: "img_2", role: "subject_ref" }   ← img_2 uses canvas portrait as subject
    { from: "img_1", to: "vid_1", role: "depends_on" }            ← vid_1 animates the output of img_1
    { from: "img_2", to: "vid_2", role: "depends_on" }            ← vid_2 animates the output of img_2
- Use edges: depends_on (output feeds next node), style_ref (visual style source), subject_ref (subject/character reference).
- Reference existing canvas items by their node ID in promptIntent when relevant.
- Keep video nodes ≤10s; split longer sequences with concat nodes.
- Video duration MUST be exactly 4, 6, or 8 seconds — no other values are valid. Default to 4 when the user has not specified.
- If the request is genuinely ambiguous, add clarifications[] but still emit a best-effort plan.
- Never put generation descriptions in conversational text — always emit plan_production.`;

export function buildCanvasContext(nodes: AgentInput["canvasNodes"]): string {
    if (nodes.length === 0) return "";
    const items = nodes.map((n) => {
        const d = n.data;
        let desc = `- ${d.label} (id: ${n.id}, type: ${n.type.replace("canvas-", "")})`;
        if ("format" in d && d.format) desc += ` [format: ${d.format}]`;
        if ("prompt" in d && d.prompt) desc += ` — prompt: "${d.prompt}"`;
        if ("status" in d) desc += ` [${d.status}]`;
        if (n.type === "canvas-text" && "content" in d && d.content) {
            const raw = d.content as string;
            const snippet = raw.slice(0, 800);
            desc += `\n  Content:\n${snippet}${raw.length > 800 ? "\n  [… truncated]" : ""}`;
        }
        return desc;
    });
    return `\n\nCurrent canvas items:\n${items.join("\n")}\nIMPORTANT: Only use node IDs that appear in this list.`;
}

export function buildStyleInstruction(
    style: { name: string; content: string } | null | undefined,
): string {
    if (!style) return "";
    return `\n\n## Active Style: ${style.name}\nApply this style to EVERY generation step:\n\n${style.content}`;
}

function buildDefaultsInstruction(
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): string {
    const lines: string[] = [];
    if (imageDefaults?.model)
        lines.push(`- Default image model: ${imageDefaults.model}`);
    if (imageDefaults?.aspectRatio)
        lines.push(
            `- Default image aspect ratio: ${imageDefaults.aspectRatio}`,
        );
    if (imageDefaults?.imageSize)
        lines.push(`- Default image size: ${imageDefaults.imageSize}`);
    if (videoDefaults?.model)
        lines.push(`- Default video model: ${videoDefaults.model}`);
    if (videoDefaults?.aspectRatio)
        lines.push(
            `- Default video aspect ratio: ${videoDefaults.aspectRatio}`,
        );
    if (videoDefaults?.duration)
        lines.push(`- Default video duration: ${videoDefaults.duration}s`);
    if (lines.length === 0) return "";
    return `\n\nCANVAS DEFAULTS (use these when the user has not specified a model, aspect ratio, or duration):\n${lines.join("\n")}`;
}

export function buildDirectorInstruction(
    canvasContext: string,
    styleInstruction: string,
    imageDefaults?: MediaDefaults,
    videoDefaults?: VideoDefaults,
): string {
    return `${DIRECTOR_PROMPT}${buildDefaultsInstruction(imageDefaults, videoDefaults)}${canvasContext}${styleInstruction}`;
}
