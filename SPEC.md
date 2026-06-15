# SPEC: Canvas Agent Clarification Questions

## Objective

Allow the Canvas Director agent to ask the user clarifying questions before generating images or videos, whenever the request is ambiguous and the answer would meaningfully change the output (aspect ratio, duration, shot framing, camera movement, audio, etc.). The user sees an interactive widget in the chat with clickable options and a free-text fallback. Their answer is sent back as the next chat turn, continuing the conversation until the agent has enough information to plan.

**Target users:** flowcraft canvas users who give open-ended creative requests (e.g. "a cinematic shot of a mountain"), where the agent cannot infer the intended framing, format, or style from context or canvas defaults.

---

## Design Decisions

| Decision                 | Choice                                                                                                                             | Rationale                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Interaction model        | **New turn** — stream ends normally, question widget is the agent's message, user reply is the next chat message                   | No server-side blocking required; reuses the existing SSE + chat-turn architecture; mirrors how `ChatActions` already work |
| When to ask              | **Ambiguity-triggered only** — agent proceeds when context + defaults are sufficient                                               | Avoids friction on clear requests                                                                                          |
| Askable topics           | Aspect ratio/resolution, video duration, audio on/off, shot type, composition, camera movement, style/aesthetic, content specifics | All settings that materially affect visual output                                                                          |
| Max clarification rounds | **Unlimited** — agent decides when it has enough                                                                                   | Agent keeps the conversation going only as long as useful                                                                  |

---

## Core Types (`src/lib/canvas/types.ts`)

### New interfaces

```typescript
export interface QuestionOption {
    id: string; // short stable key, e.g. "16:9"
    label: string; // display text, e.g. "16:9 — Landscape"
    description?: string; // optional one-line elaboration
}

export interface QuestionPayload {
    id: string; // uuid assigned by the agent
    question: string; // e.g. "What aspect ratio should I use?"
    options: QuestionOption[]; // 2–5 valid choices
}
```

### `ChatMessage` — add field

```typescript
question?: QuestionPayload;
```

### `AgentEvent` — add variant

```typescript
| { type: "question"; question: QuestionPayload }
```

---

## ADK Tool (`src/lib/canvas/agent/tools.ts`)

### New tool: `askUserTool`

```typescript
export const askUserTool = new FunctionTool({
    name: "ask_user",
    description:
        "Ask the user a clarifying question with multiple-choice options. " +
        "Call this INSTEAD of plan_production when the request is ambiguous and the " +
        "answer would change the plan meaningfully. Do NOT ask about things already " +
        "specified in the user message, canvas defaults, or active style. " +
        "Options MUST be valid values (e.g. video duration must be 4, 6, or 8 s). " +
        "After the user replies, continue with plan_production or ask_user again.",
    parameters: z.object({
        id: z
            .string()
            .describe(
                "A short stable identifier for this question, e.g. 'aspect_ratio'",
            ),
        question: z.string().describe("The question to ask the user"),
        options: z
            .array(
                z.object({
                    id: z.string(),
                    label: z.string(),
                    description: z.string().optional(),
                }),
            )
            .min(2)
            .max(5)
            .describe(
                "Valid choices. Must include at minimum the most common reasonable options.",
            ),
    }),
    execute: async (args) => args,
});
```

**Option validity rules** — the agent must know these; they go into `DIRECTOR_PROMPT`:

- Image aspect ratios (from `IMAGE_MODEL_CONFIGS` in `constants.ts` — union across all models): `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`, `1:4`, `1:8`, `4:1`, `8:1`, `Auto`
- Video aspect ratios: `16:9`, `9:16`
- Video duration: `4`, `6`, `8` (seconds only — no other values)
- Shot types & camera movement: load `cinematography` skill (`src/lib/canvas/agent/skills/primitives/cinematography/SKILL.md`) — it contains the exhaustive vocabulary and provides guidance on which 3–5 options to surface per scene type
- Audio: `yes — generated audio`, `no — silent`

---

## Event Extraction (`src/lib/canvas/agent/event-extractor.ts`)

When the ADK event loop encounters a `ask_user` function call:

1. Parse `call.args` as `QuestionPayload`.
2. Emit `{ type: "question", question: payload }`.
3. **Do not accumulate steps** — a question turn never co-exists with a plan in the same turn. Emit `done` normally after all events are processed.

---

## Agent Registration (`src/lib/canvas/agent/canvas-agent.ts`)

Add `askUserTool` to the agent's tool list alongside existing tools.

---

## System Prompt (`src/lib/canvas/agent/prompts.ts`)

Extend `DIRECTOR_PROMPT` with a new section inserted **before** the existing REQUIRED RESPONSE SEQUENCE:

```
CLARIFICATION RULE — before planning, check for ambiguity:
- If the request is underspecified in a way that would materially change the plan (e.g. aspect ratio unknown, video duration unspecified and no default set, shot framing unclear for a close-up vs. wide scene), call ask_user with 2–5 valid options.
- Do NOT ask if: the user already specified the setting, a canvas default is set, or the choice is obvious from context.
- Options must always be valid values (see VALID OPTION VALUES below).
- After the user answers, proceed with the normal REQUIRED RESPONSE SEQUENCE.

VALID OPTION VALUES (use exactly these — never invent values):
- Image aspect ratio: 1:1 | 3:2 | 2:3 | 3:4 | 4:3 | 4:5 | 5:4 | 9:16 | 16:9 | 21:9 | 1:4 | 1:8 | 4:1 | 8:1
- Video aspect ratio: 16:9 | 9:16 | 1:1
- Video duration: 4s | 6s | 8s
- Shot type / camera movement: load the cinematography skill first, then surface the 3–5 most scene-appropriate options (see skill for full vocabulary and selection rules)
- Audio: yes (generated audio) | no (silent)
```

---

## API Route (`src/app/api/canvases/[id]/chat/route.ts`)

Forward the new `question` event as an SSE frame — same pattern as existing events:

```typescript
case "question":
    yield formatSSE("question", event.question);
    break;
```

No other route changes needed.

---

## Frontend — SSE Handling (`src/components/canvas/canvas-chat-input.tsx`)

In `parseSSEEvents` / the event dispatch loop, handle the new `question` event:

```typescript
case "question": {
    const payload = JSON.parse(e.data) as QuestionPayload;
    updateMessage(assistantId, { question: payload });
    break;
}
```

This sets the `question` field on the assistant's `ChatMessage` in the store. No further changes to the input component are needed — the widget lives in the messages list.

---

## UI Widget (`src/components/canvas/question-widget.tsx`)

New component, rendered inside the assistant chat bubble when `message.question` is set.

### Behaviour

- Shows the question text.
- Renders 2–5 option buttons. Clicking one immediately submits it as the user's next chat message (same as clicking a `ChatAction`).
- A small text input at the bottom lets the user type a custom answer and press Enter/Submit.
- Once the user has answered (for this message turn), the widget becomes read-only (options greyed out, input disabled). The widget stays visible in history.

### Props

```typescript
interface QuestionWidgetProps {
    question: QuestionPayload;
    onAnswer: (answer: string) => void; // sends the answer as the next user turn
    answered: boolean; // true after the user has responded
}
```

### Layout (sketch)

```
┌─────────────────────────────────────────────┐
│ What aspect ratio should I use?             │
│                                             │
│  [ 16:9 – Landscape ]  [ 9:16 – Portrait ] │
│  [ 1:1 – Square ]                           │
│                                             │
│  ┌─────────────────────────┐  [Send]        │
│  │ or type your own…       │                │
│  └─────────────────────────┘                │
└─────────────────────────────────────────────┘
```

---

## Chat Messages Renderer (`src/components/canvas/canvas-chat-messages.tsx`)

In the assistant message rendering block, after text/plan/actions, add:

```tsx
{
    message.question && (
        <QuestionWidget
            question={message.question}
            onAnswer={(answer) => sendMessage(answer)} // injected via prop or store
            answered={/* true when a subsequent user message exists after this one */}
        />
    );
}
```

The `answered` flag is derived by checking whether a user message with a later `createdAt` exists in the history.

---

## Answering Flow

1. User types "a cinematic mountain shot".
2. Agent calls `ask_user` → stream emits `question` event → `done`.
3. Frontend stores the question in the assistant's `ChatMessage`; renders `QuestionWidget`.
4. User clicks "16:9 – Landscape" → `onAnswer("16:9 – Landscape")`.
5. `onAnswer` calls the existing `sendMessage` path with that string as the user message content.
6. New chat turn: user message is "16:9 – Landscape", agent now has enough context → calls `plan_production`.
7. (Optional) Agent may call `ask_user` again for a second clarification — same flow.

The `QuestionWidget` for the first message becomes `answered=true` once the user's reply appears in history.

---

## Files to Create / Modify

| File                                             | Change                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/canvas/types.ts`                        | Add `QuestionOption`, `QuestionPayload`; add `question?` to `ChatMessage`; add `question` variant to `AgentEvent` |
| `src/lib/canvas/agent/tools.ts`                  | Add `askUserTool`                                                                                                 |
| `src/lib/canvas/agent/canvas-agent.ts`           | Register `askUserTool` in the agent's tool list                                                                   |
| `src/lib/canvas/agent/event-extractor.ts`        | Handle `ask_user` function call → emit `question` event                                                           |
| `src/lib/canvas/agent/prompts.ts`                | Add clarification rule + valid option values to `DIRECTOR_PROMPT`                                                 |
| `src/app/api/canvases/[id]/chat/route.ts`        | Forward `question` SSE event                                                                                      |
| `src/components/canvas/canvas-chat-input.tsx`    | Handle `question` SSE event → `updateMessage({ question })`                                                       |
| `src/components/canvas/question-widget.tsx`      | **New component** — interactive question widget                                                                   |
| `src/components/canvas/canvas-chat-messages.tsx` | Render `<QuestionWidget>` inside assistant messages that have `question`                                          |

---

## Testing Strategy

### Unit tests (`src/tests/`)

- `event-extractor.test.ts`: add case for `ask_user` function call → asserts `question` event is emitted; asserts no plan is emitted in the same turn.
- `question-widget.test.tsx`: renders options; clicking an option calls `onAnswer`; free-text input + Enter calls `onAnswer`; `answered=true` disables controls.

### Manual acceptance criteria

- [ ] Agent remains silent on unambiguous requests (e.g. "generate a 16:9 landscape photo of a mountain").
- [ ] Agent asks one question when aspect ratio is missing and no default is set.
- [ ] Widget options match only valid values (e.g. video duration shows only 4s, 6s, 8s).
- [ ] Clicking an option sends it as the next user chat turn (visible in history).
- [ ] Typing a custom answer and pressing Enter sends it correctly.
- [ ] After answering, the widget becomes read-only.
- [ ] Agent can ask a second question after the first answer (unlimited rounds).
- [ ] If a canvas default covers the ambiguity, the agent skips asking.

---

## Out of Scope

- Multi-question cards (one question at a time keeps the UX simple).
- Persisting which question was "answered" across page refreshes (the `answered` flag is derived from message timestamps, which are persisted).
- Agent asking about generation model selection (model picker already exists in the UI).
