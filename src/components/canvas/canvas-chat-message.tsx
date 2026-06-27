"use client";

import React, { memo, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    User,
    Bot,
    Image,
    Video,
    Text,
    Music,
    Zap,
    Check,
    Loader2,
    Clock,
    X,
    Play,
    Ban,
    ChevronRight,
    Brain,
    Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
    AgentPlan,
    ChatMessage,
    GenerationStep,
    PlanStatus,
    StepStatus,
} from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { cn } from "@/lib/utils";
import { QuestionWidget } from "./question-widget";

function formatTime(isoString: string): string {
    try {
        return new Date(isoString).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

const MEDIA_TYPE_ICON = {
    "canvas-image": Image,
    "canvas-video": Video,
    "canvas-text": Text,
    "canvas-audio": Music,
} as const;

function StepStatusIcon({ status }: { status: StepStatus | undefined }) {
    switch (status) {
        case "done":
            return <Check className="text-primary size-3" />;
        case "generating":
            return <Loader2 className="text-primary size-3 animate-spin" />;
        case "error":
            return <X className="text-destructive size-3" />;
        default:
            return <Clock className="text-muted-foreground size-3" />;
    }
}

const STEP_TYPE_ICON: Record<
    string,
    React.ComponentType<{ className?: string }>
> = {
    image: Image,
    video: Video,
    audio: Music,
};

/** Small pill for a single metadata value */
function MetaChip({ label }: { label: string }) {
    return (
        <span className="bg-background text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] leading-none">
            {label}
        </span>
    );
}

function StepCard({
    step,
    stepIndex,
    steps,
    status,
    isApproved,
}: {
    step: GenerationStep;
    stepIndex: number;
    steps: GenerationStep[];
    status: StepStatus | undefined;
    isApproved: boolean;
}) {
    const TypeIcon = STEP_TYPE_ICON[step.type] ?? Image;
    const nodes = useCanvasStore((s) => s.nodes);
    const [isPromptExpanded, setIsPromptExpanded] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopyPrompt = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            navigator.clipboard.writeText(step.prompt);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        },
        [step.prompt],
    );

    // Build metadata chips
    const chips: string[] = [];
    if (step.aspectRatio) chips.push(step.aspectRatio);
    if (step.type === "image" && step.imageSize) chips.push(step.imageSize);
    if (step.type === "video" && step.resolution) chips.push(step.resolution);
    if (step.model) chips.push(step.model.split("/").pop() ?? step.model);
    if (step.type === "video" && step.duration) chips.push(`${step.duration}s`);
    if (step.generateAudio) chips.push("audio");

    // Resolve dependency labels
    const depLabels: string[] = (step.dependsOn ?? []).map((depId) => {
        const depStep = steps.find((s) => s.id === depId);
        return depStep?.label ?? depId;
    });
    if (depLabels.length > 0) chips.push(`from: ${depLabels.join(", ")}`);

    // Resolve reference node labels
    const refLabels: string[] = (step.referenceNodeIds ?? []).map((refId) => {
        const node = nodes.find((n) => n.id === refId);
        return node?.data.label ?? "Unknown Node";
    });
    if (refLabels.length > 0) chips.push(`ref: ${refLabels.join(", ")}`);

    // Resolve first/last frame labels
    if (step.firstFrameNodeId) {
        const node = nodes.find((n) => n.id === step.firstFrameNodeId);
        chips.push(`start: ${node?.data.label ?? "Unknown Node"}`);
    }
    if (step.lastFrameNodeId) {
        const node = nodes.find((n) => n.id === step.lastFrameNodeId);
        chips.push(`end: ${node?.data.label ?? "Unknown Node"}`);
    }

    return (
        <div className={cn("space-y-1.5", status === "error" && "opacity-60")}>
            {/* Header row */}
            <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                    {isApproved ? (
                        <StepStatusIcon status={status} />
                    ) : (
                        <TypeIcon className="text-muted-foreground size-3" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <span
                        className={cn(
                            "block truncate leading-none font-medium",
                            status === "done" && "text-foreground",
                            status === "generating" && "text-primary",
                            status === "error" &&
                                "text-destructive line-through",
                            !status && "text-muted-foreground",
                        )}
                    >
                        {step.label ??
                            (step.type === "image"
                                ? "Image"
                                : step.type === "audio"
                                  ? "Audio"
                                  : "Video")}{" "}
                        <span className="font-normal opacity-50">
                            #{stepIndex + 1}
                        </span>
                    </span>

                    {/* Prompt preview */}
                    <div className="group/prompt mt-0.5">
                        <p
                            className={cn(
                                "text-muted-foreground/70 cursor-pointer text-[10px] leading-relaxed",
                                !isPromptExpanded && "line-clamp-2",
                            )}
                            onClick={() => setIsPromptExpanded((v) => !v)}
                            title={
                                isPromptExpanded
                                    ? "Click to collapse"
                                    : "Click to expand"
                            }
                        >
                            {step.prompt}
                        </p>
                        {isPromptExpanded && (
                            <button
                                type="button"
                                onClick={handleCopyPrompt}
                                className="text-muted-foreground/50 hover:text-muted-foreground mt-1 flex items-center gap-1 text-[10px] transition-colors"
                            >
                                {isCopied ? (
                                    <>
                                        <Check className="size-2.5" /> Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="size-2.5" /> Copy
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
                {status === "generating" && (
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                        generating…
                    </span>
                )}
            </div>

            {/* Metadata chips */}
            {chips.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-5">
                    {chips.map((chip) => (
                        <MetaChip key={chip} label={chip} />
                    ))}
                </div>
            )}
        </div>
    );
}

function PlanApprovalCard({
    steps,
    messageId,
    planStatus,
    onProceed,
    onCancel,
}: {
    steps: GenerationStep[];
    messageId: string;
    planStatus: PlanStatus | undefined;
    onProceed?: (messageId: string, plan: AgentPlan) => void;
    onCancel?: (messageId: string) => void;
}) {
    const stepStatuses =
        useCanvasStore((s) => s.planStepStatuses[messageId]) ?? {};
    const setPlanStatus = useCanvasStore((s) => s.setPlanStatus);

    const doneCount = steps.filter((s) => stepStatuses[s.id] === "done").length;
    const isPending = planStatus === "pending_approval";
    const isApproved = planStatus === "approved";
    const isCancelled = planStatus === "cancelled";

    const handleProceed = useCallback(() => {
        onProceed?.(messageId, { steps });
    }, [onProceed, messageId, steps]);

    const handleCancel = useCallback(() => {
        setPlanStatus(messageId, "cancelled");
        onCancel?.(messageId);
    }, [setPlanStatus, messageId, onCancel]);

    return (
        <div
            className={cn(
                "bg-muted/60 mt-1.5 rounded-lg border text-xs",
                isCancelled && "opacity-50",
            )}
        >
            {/* Card header */}
            <div className="px-3 pt-2.5 pb-2">
                <p className="text-muted-foreground font-medium">
                    {isCancelled
                        ? "Plan cancelled"
                        : isApproved &&
                            doneCount === steps.length &&
                            steps.length > 0
                          ? `${steps.length} generation${steps.length > 1 ? "s" : ""} complete`
                          : `${steps.length} generation${steps.length > 1 ? "s" : ""} planned`}
                </p>
            </div>

            {/* Steps separated by dividers */}
            {steps.map((step, idx) => {
                const status = isApproved
                    ? (stepStatuses[step.id] as StepStatus | undefined)
                    : undefined;
                return (
                    <div key={step.id}>
                        <div className="border-t" />
                        <div className="px-3 py-2.5">
                            <StepCard
                                step={step}
                                stepIndex={idx}
                                steps={steps}
                                status={status}
                                isApproved={isApproved}
                            />
                        </div>
                    </div>
                );
            })}

            {/* Proceed / Cancel buttons */}
            {isPending && (
                <div className="flex gap-2 border-t px-3 py-2.5">
                    <Button
                        size="sm"
                        className="h-7 gap-1.5 rounded-md px-3 text-xs"
                        onClick={handleProceed}
                    >
                        <Play className="size-3" />
                        Proceed
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground h-7 gap-1.5 rounded-md px-3 text-xs"
                        onClick={handleCancel}
                    >
                        <Ban className="size-3" />
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    );
}

function SuggestedActions({
    actions,
    disabled,
    onAction,
}: {
    actions: { id: string; label: string; prompt: string }[];
    disabled: boolean;
    onAction: (prompt: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1.5 pt-1">
            {actions.map((action) => (
                <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onAction(action.prompt)}
                    className="h-7 gap-1.5 rounded-md px-3 text-xs"
                >
                    <Zap className="size-3" />
                    {action.label}
                </Button>
            ))}
        </div>
    );
}

/** Shows suggested actions only once every plan step is done */
function PlanCompletedActions({
    actions,
    steps,
    messageId,
    disabled,
    onAction,
}: {
    actions: { id: string; label: string; prompt: string }[];
    steps: GenerationStep[];
    messageId: string;
    disabled: boolean;
    onAction: (prompt: string) => void;
}) {
    const stepStatuses =
        useCanvasStore((s) => s.planStepStatuses[messageId]) ?? {};
    const allDone =
        steps.length > 0 &&
        steps.every(
            (s) =>
                stepStatuses[s.id] === "done" || stepStatuses[s.id] === "error",
        );

    if (!allDone) return null;

    return (
        <SuggestedActions
            actions={actions}
            disabled={disabled}
            onAction={onAction}
        />
    );
}

function DirectorLog({
    log,
}: {
    log: import("@/lib/canvas/types").DirectorLogEntry[];
}) {
    const [openStates, setOpenStates] = useState<Record<number, boolean>>({});
    const toggle = (i: number) =>
        setOpenStates((prev) => ({ ...prev, [i]: !prev[i] }));

    return (
        <div className="flex flex-col gap-1">
            {log.map((entry, i) =>
                entry.type === "thought" ? (
                    <div key={i}>
                        <button
                            type="button"
                            onClick={() => toggle(i)}
                            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
                        >
                            <Brain className="size-3 shrink-0" />
                            <span className="line-clamp-1 max-w-[240px] text-left italic">
                                {entry.text.slice(0, 80).trimEnd()}
                                {entry.text.length > 80 ? "…" : ""}
                            </span>
                            <ChevronRight
                                className={cn(
                                    "size-3 shrink-0 transition-transform",
                                    openStates[i] && "rotate-90",
                                )}
                            />
                        </button>
                        {openStates[i] && (
                            <div className="border-muted-foreground/20 text-muted-foreground mt-1 border-l-2 pl-3 text-xs leading-relaxed whitespace-pre-wrap">
                                {entry.text}
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        key={i}
                        className="text-muted-foreground flex items-center gap-1.5 text-xs"
                    >
                        <Zap className="size-3 shrink-0" />
                        <span>{entry.label}</span>
                    </div>
                ),
            )}
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center gap-1 py-0.5">
            {[0, 150, 300].map((delay) => (
                <span
                    key={delay}
                    className="bg-muted-foreground/50 size-1.5 animate-pulse rounded-full"
                    style={{
                        animationDelay: `${delay}ms`,
                        animationDuration: "900ms",
                    }}
                />
            ))}
        </div>
    );
}

function CanvasChatMessageComponent({
    message,
    isLiveAssistant = false,
    onExecutePlan,
    questionAnswered = false,
}: {
    message: ChatMessage;
    isLiveAssistant?: boolean;
    onExecutePlan?: (messageId: string, plan: AgentPlan) => void;
    questionAnswered?: boolean;
}) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const isChatLoading = useCanvasStore((s) => s.isChatLoading);
    const setPendingActionPrompt = useCanvasStore(
        (s) => s.setPendingActionPrompt,
    );

    const handleActionClick = useCallback(
        (prompt: string) => {
            if (isChatLoading) return;
            setPendingActionPrompt(prompt);
        },
        [isChatLoading, setPendingActionPrompt],
    );

    if (isSystem) {
        return (
            <div className="flex justify-center px-4 py-2">
                <span className="text-muted-foreground text-xs">
                    {message.content}
                </span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex gap-2.5 px-4 py-3",
                isUser && "flex-row-reverse",
            )}
        >
            <div
                className={cn(
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full",
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                )}
            >
                {isUser ? (
                    <User className="size-3.5" />
                ) : (
                    <Bot className="size-3.5" />
                )}
                {isLiveAssistant && (
                    <span className="bg-primary absolute -right-0.5 -bottom-0.5 size-2 animate-pulse rounded-full" />
                )}
            </div>

            <div
                className={cn(
                    "flex max-w-[85%] min-w-0 flex-col gap-1",
                    isUser && "items-end",
                )}
            >
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {message.attachments.map((att) => {
                            const Icon = MEDIA_TYPE_ICON[att.type];
                            return (
                                <span
                                    key={att.nodeId}
                                    className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                >
                                    <Icon className="size-3" />
                                    {att.label}
                                </span>
                            );
                        })}
                    </div>
                )}

                {!isUser &&
                    message.directorLog &&
                    message.directorLog.length > 0 && (
                        <DirectorLog log={message.directorLog} />
                    )}

                <div
                    className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        isUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                    )}
                >
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : message.content === "" && isLiveAssistant ? (
                        <TypingDots />
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_ol]:my-1 [&_p]:my-1 [&_pre]:my-2 [&_ul]:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {!isUser && message.plan && message.plan.steps.length > 0 && (
                    <PlanApprovalCard
                        steps={message.plan.steps}
                        messageId={message.id}
                        planStatus={message.planStatus}
                        onProceed={onExecutePlan}
                    />
                )}

                {message.generatedMedia &&
                    message.generatedMedia.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {message.generatedMedia.map((media) => {
                                const Icon = MEDIA_TYPE_ICON[media.type];
                                return (
                                    <span
                                        key={media.nodeId}
                                        className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                    >
                                        <Icon className="size-3" />
                                        Generated
                                    </span>
                                );
                            })}
                        </div>
                    )}

                {!isUser &&
                    !isLiveAssistant &&
                    message.actions &&
                    message.actions.length > 0 &&
                    // If there's a plan, only show actions once all generations are done
                    !message.plan && (
                        <SuggestedActions
                            actions={message.actions}
                            disabled={isChatLoading}
                            onAction={handleActionClick}
                        />
                    )}
                {!isUser &&
                    !isLiveAssistant &&
                    message.actions &&
                    message.actions.length > 0 &&
                    message.plan &&
                    message.planStatus === "approved" && (
                        <PlanCompletedActions
                            actions={message.actions}
                            steps={message.plan.steps}
                            messageId={message.id}
                            disabled={isChatLoading}
                            onAction={handleActionClick}
                        />
                    )}

                {!isUser && message.question && (
                    <QuestionWidget
                        question={message.question}
                        onAnswer={handleActionClick}
                        answered={questionAnswered}
                    />
                )}

                <span className="text-muted-foreground px-1 text-[10px]">
                    {formatTime(message.createdAt)}
                </span>
            </div>
        </div>
    );
}

export const CanvasChatMessage = memo(
    CanvasChatMessageComponent,
) as typeof CanvasChatMessageComponent;
