"use client";

import {
    useState,
    useCallback,
    useRef,
    useMemo,
    useEffect,
    type KeyboardEvent,
} from "react";
import {
    SendHorizonal,
    Loader2,
    Check,
    ShieldCheck,
    ChevronDown,
    Search,
} from "lucide-react";
import { StyleThumbnail } from "./style-thumbnail";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    CanvasAgentSettingsDialog,
    DEFAULT_AGENT_SETTINGS,
    type AgentSettings,
} from "./canvas-agent-settings-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StyleDocument } from "@/lib/styles/style-types";
import { STYLE_TEMPLATES } from "@/lib/styles/style-templates";
import { useCanvasStore } from "@/lib/store/use-canvas-store";
import { CanvasAttachmentBar } from "./canvas-attachment-bar";
import {
    CanvasMentionDropdown,
    type MentionItem,
} from "./canvas-mention-dropdown";
import { CanvasSlashAutocomplete } from "./canvas-slash-autocomplete";
import type {
    ChatMessage,
    ChatAttachment,
    CanvasImageData,
    CanvasVideoData,
    CanvasAudioData,
    CanvasNodeData,
    GeneratedMediaRef,
    NodePayload,
    GenerationStep,
    AgentPlan,
    QuestionPayload,
} from "@/lib/canvas/types";
import { calculateNodePositions } from "@/lib/canvas/layout";

interface SSEEvent {
    event: string;
    data: string;
}

function parseSSEEvents(
    chunk: string,
    buffer: string,
): { events: SSEEvent[]; remaining: string } {
    const raw = buffer + chunk;
    const events: SSEEvent[] = [];
    const blocks = raw.split("\n\n");

    const remaining = blocks.pop() ?? "";

    for (const block of blocks) {
        if (!block.trim()) continue;
        let event = "";
        let data = "";
        for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7);
            else if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (event && data) {
            events.push({ event, data });
        }
    }

    return { events, remaining };
}

function RulesetThumbnail({ active }: { active: boolean }) {
    return (
        <div
            className={cn(
                "bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                active && "border-emerald-500/20",
            )}
        >
            <ShieldCheck
                className={cn(
                    "size-4",
                    active
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                )}
            />
        </div>
    );
}

interface CanvasChatInputProps {
    getViewportCenter: () => { x: number; y: number };
    centerOnNodes: (x: number, y: number) => void;
    executePlanStreamRef?: React.RefObject<
        ((messageId: string, plan: AgentPlan) => Promise<void>) | null
    >;
}

export function CanvasChatInput({
    getViewportCenter,
    centerOnNodes,
    executePlanStreamRef,
}: CanvasChatInputProps) {
    const [input, setInput] = useState("");
    const [agentSettings, setAgentSettings] = useState<AgentSettings>(
        DEFAULT_AGENT_SETTINGS,
    );
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // @mention state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
    const [mentionedNodeIds, setMentionedNodeIds] = useState<Set<string>>(
        new Set(),
    );
    const mentionTriggerPos = useRef<number | null>(null);

    // Slash command autocomplete state
    const [userSkillsForAutocomplete, setUserSkillsForAutocomplete] = useState<
        { name: string }[]
    >([]);
    const [slashQuery, setSlashQuery] = useState<string | null>(null);
    const [slashIndex, setSlashIndex] = useState(0);
    const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
    const slashTriggerPos = useRef<number | null>(null);

    // Fetch user skills on mount to populate autocomplete suggestions
    useEffect(() => {
        const fetchSkillsForAutocomplete = async () => {
            try {
                const res = await fetch("/api/skills?tab=my");
                if (res.ok) {
                    const data = await res.json();
                    setUserSkillsForAutocomplete(data.skills ?? []);
                }
            } catch (err) {
                console.error("Failed to fetch skills for autocomplete", err);
            }
        };
        void fetchSkillsForAutocomplete();
    }, []);

    const disabledSkills = useCanvasStore((s) => s.disabledSkills);

    const availableSkills = useMemo(() => {
        const BUILT_IN_SKILL_NAMES = [
            "character-generation",
            "long-video",
            "storyboard",
            "virtual-tryon",
        ];
        const customNames = userSkillsForAutocomplete.map((s) => s.name);
        const allNames = Array.from(
            new Set([...BUILT_IN_SKILL_NAMES, ...customNames]),
        );
        // Filter out disabled ones
        return allNames.filter((name) => !disabledSkills.includes(name));
    }, [userSkillsForAutocomplete, disabledSkills]);

    const filteredSlashSkills = useMemo(() => {
        if (slashQuery === null) return [];
        const q = slashQuery.toLowerCase();
        return availableSkills.filter((name) => name.toLowerCase().includes(q));
    }, [availableSkills, slashQuery]);

    // Dismissed selection-based attachment node IDs
    const [dismissedNodeIds, setDismissedNodeIds] = useState<Set<string>>(
        new Set(),
    );

    // Style picker state
    const [userStyles, setUserStyles] = useState<StyleDocument[]>([]);
    const [activeStyleName, setActiveStyleName] = useState<string | null>(null);
    const [activeStyleImageUrl, setActiveStyleImageUrl] = useState<
        string | null
    >(null);
    const [styleSearch, setStyleSearch] = useState("");

    const filteredUserStyles = useMemo(() => {
        if (!styleSearch.trim()) return userStyles;
        const query = styleSearch.toLowerCase();
        return userStyles.filter((s) => s.name.toLowerCase().includes(query));
    }, [userStyles, styleSearch]);

    const filteredTemplates = useMemo(() => {
        if (!styleSearch.trim()) return STYLE_TEMPLATES;
        const query = styleSearch.toLowerCase();
        return STYLE_TEMPLATES.filter((t) =>
            t.name.toLowerCase().includes(query),
        );
    }, [styleSearch]);

    const [userRulesets, setUserRulesets] = useState<
        { id: string; name: string }[]
    >([]);

    const canvasId = useCanvasStore((s) => s.canvasId);
    const sessionId = useCanvasStore((s) => s.sessionId);
    const nodes = useCanvasStore((s) => s.nodes);
    const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
    const activeStyleId = useCanvasStore((s) => s.activeStyleId);
    const setActiveStyleId = useCanvasStore((s) => s.setActiveStyleId);
    const activeRulesetId = useCanvasStore((s) => s.activeRulesetId);
    const activeRulesetName = useCanvasStore((s) => s.activeRulesetName);
    const setActiveRuleset = useCanvasStore((s) => s.setActiveRuleset);
    const addMessage = useCanvasStore((s) => s.addMessage);
    const updateMessage = useCanvasStore((s) => s.updateMessage);
    const isChatLoading = useCanvasStore((s) => s.isChatLoading);
    const setIsChatLoading = useCanvasStore((s) => s.setIsChatLoading);
    const addNode = useCanvasStore((s) => s.addNode);
    const getNextLabel = useCanvasStore((s) => s.getNextLabel);
    const setPlanStepStatus = useCanvasStore((s) => s.setPlanStepStatus);
    const pendingActionPrompt = useCanvasStore((s) => s.pendingActionPrompt);
    const setPendingActionPrompt = useCanvasStore(
        (s) => s.setPendingActionPrompt,
    );
    const setPlanStatus = useCanvasStore((s) => s.setPlanStatus);

    // Build mention items from all canvas nodes
    const mentionItems: MentionItem[] = useMemo(
        () =>
            nodes.map((n) => ({
                id: n.id,
                label: n.data.label,
                type: n.type,
            })),
        [nodes],
    );

    const filteredMentionItems = useMemo(
        () =>
            mentionQuery !== null
                ? mentionItems.filter((item) =>
                      item.label
                          .toLowerCase()
                          .includes(mentionQuery.toLowerCase()),
                  )
                : [],
        [mentionItems, mentionQuery],
    );

    // Selection-based attachments (all node types, minus dismissed)
    const selectionAttachments: ChatAttachment[] = useMemo(() => {
        return selectedNodeIds
            .filter((id) => !dismissedNodeIds.has(id))
            .map((id) => {
                const node = nodes.find((n) => n.id === id);
                if (!node) return null;
                return {
                    nodeId: node.id,
                    label: node.data.label,
                    type: node.type,
                } as ChatAttachment;
            })
            .filter(Boolean) as ChatAttachment[];
    }, [selectedNodeIds, nodes, dismissedNodeIds]);

    // Mention-based attachments (all node types)
    const mentionAttachments: ChatAttachment[] = useMemo(() => {
        return Array.from(mentionedNodeIds)
            .filter((id) => !selectionAttachments.some((a) => a.nodeId === id))
            .map((id) => {
                const node = nodes.find((n) => n.id === id);
                if (!node) return null;
                return {
                    nodeId: node.id,
                    label: node.data.label,
                    type: node.type,
                } as ChatAttachment;
            })
            .filter(Boolean) as ChatAttachment[];
    }, [mentionedNodeIds, nodes, selectionAttachments]);

    const allAttachments = useMemo(
        () => [...selectionAttachments, ...mentionAttachments],
        [selectionAttachments, mentionAttachments],
    );

    // Reset dismissed list when canvas selection changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissedNodeIds(new Set());
    }, [selectedNodeIds]);

    // Fetch user styles for the picker
    useEffect(() => {
        void fetch("/api/styles")
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load styles");
                return r.json();
            })
            .then((data: { styles: StyleDocument[] }) =>
                setUserStyles(data.styles ?? []),
            )
            .catch(() => toast.error("Failed to load styles"));
    }, []);

    // Resolve active style name and image from ID
    useEffect(() => {
        if (!activeStyleId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveStyleName(null);
            setActiveStyleImageUrl(null);
            return;
        }

        const resolveStyle = async (styleId: string) => {
            // 1. Check templates
            const template = STYLE_TEMPLATES.find((t) => t.id === styleId);
            if (template) {
                setActiveStyleName(template.name);
                setActiveStyleImageUrl(
                    template.referenceImageUris?.[0] ?? null,
                );
                return;
            }

            // 2. Check user styles
            const userStyle = userStyles.find((s) => s.id === styleId);
            if (userStyle) {
                setActiveStyleName(userStyle.name);
                setActiveStyleImageUrl(
                    userStyle.referenceImageUris?.[0] ?? null,
                );
                return;
            }

            // 3. Fetch from API if not found
            try {
                const res = await fetch(`/api/styles/${styleId}`);
                if (res.ok) {
                    const s: StyleDocument = await res.json();
                    setActiveStyleName(s.name);
                    setActiveStyleImageUrl(s.referenceImageUris?.[0] ?? null);
                } else {
                    setActiveStyleName(null);
                    setActiveStyleImageUrl(null);
                }
            } catch {
                setActiveStyleName(null);
                setActiveStyleImageUrl(null);
            }
        };

        void resolveStyle(activeStyleId);
    }, [activeStyleId, userStyles]);

    const handleSelectStyle = useCallback(
        async (styleId: string) => {
            try {
                const res = await fetch(`/api/canvases/${canvasId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activeStyleId: styleId }),
                });
                if (!res.ok) throw new Error("Failed to set style");
                setActiveStyleId(styleId);
            } catch {
                toast.error("Failed to apply style");
            }
        },
        [canvasId, setActiveStyleId],
    );

    const handleClearStyle = useCallback(async () => {
        try {
            const res = await fetch(`/api/canvases/${canvasId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activeStyleId: null }),
            });
            if (!res.ok) throw new Error("Failed to clear style");
            setActiveStyleId(null);
        } catch {
            toast.error("Failed to clear style");
        }
    }, [canvasId, setActiveStyleId]);

    // Fetch rulesets for the picker
    useEffect(() => {
        void fetch("/api/rulesets?tab=my")
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load rulesets");
                return r.json();
            })
            .then((data: { rulesets: { id: string; name: string }[] }) =>
                setUserRulesets(data.rulesets ?? []),
            )
            .catch(() => {});
    }, []);

    const handleSelectRuleset = useCallback(
        async (id: string, name: string) => {
            if (!canvasId) return;
            try {
                const res = await fetch(`/api/canvases/${canvasId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        activeRulesetId: id,
                        activeRulesetName: name,
                    }),
                });
                if (!res.ok) throw new Error("Failed to set ruleset");
                setActiveRuleset(id, name);
            } catch {
                toast.error("Failed to apply ruleset");
            }
        },
        [canvasId, setActiveRuleset],
    );

    const handleClearRuleset = useCallback(async () => {
        if (!canvasId) return;
        try {
            const res = await fetch(`/api/canvases/${canvasId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activeRulesetId: null,
                    activeRulesetName: null,
                }),
            });
            if (!res.ok) throw new Error("Failed to clear ruleset");
            setActiveRuleset(null, null);
        } catch {
            toast.error("Failed to clear ruleset");
        }
    }, [canvasId, setActiveRuleset]);

    const handleRemoveAttachment = useCallback(
        (nodeId: string) => {
            if (mentionedNodeIds.has(nodeId)) {
                setMentionedNodeIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
                // Also remove the @Label text from input
                const node = nodes.find((n) => n.id === nodeId);
                if (node) {
                    setInput((prev) =>
                        prev.replace(
                            new RegExp(`@${escapeRegex(node.data.label)}\\s?`),
                            "",
                        ),
                    );
                }
            } else {
                setDismissedNodeIds((prev) => new Set(prev).add(nodeId));
            }
        },
        [mentionedNodeIds, nodes],
    );

    // @mention detection in textarea
    const detectMention = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;

        const cursorPos = el.selectionStart;
        const textBeforeCursor = el.value.slice(0, cursorPos);

        const atIndex = textBeforeCursor.lastIndexOf("@");
        if (atIndex === -1) {
            setMentionQuery(null);
            mentionTriggerPos.current = null;
            return;
        }

        const query = textBeforeCursor.slice(atIndex + 1);
        if (query.includes(" ") || query.includes("\n")) {
            setMentionQuery(null);
            mentionTriggerPos.current = null;
            return;
        }

        mentionTriggerPos.current = atIndex;
        setMentionQuery(query);
        setMentionIndex(0);

        // Position the dropdown above the textarea (since it's at the bottom of the screen)
        const rect = el.getBoundingClientRect();
        setMentionPos({
            top: rect.top - 4,
            left: rect.left + 12,
        });
    }, []);

    const closeMention = useCallback(() => {
        setMentionQuery(null);
        mentionTriggerPos.current = null;
    }, []);

    const handleMentionSelect = useCallback(
        (item: MentionItem) => {
            const el = textareaRef.current;
            if (!el || mentionTriggerPos.current === null) return;

            const before = input.slice(0, mentionTriggerPos.current);
            const after = input.slice(el.selectionStart);
            const newValue = `${before}@${item.label} ${after}`;

            setInput(newValue);
            setMentionedNodeIds((prev) => new Set(prev).add(item.id));
            closeMention();

            // Restore cursor position after the inserted mention
            const cursorPos = before.length + 1 + item.label.length + 1;
            requestAnimationFrame(() => {
                el.focus();
                el.selectionStart = cursorPos;
                el.selectionEnd = cursorPos;
            });
        },
        [input, closeMention],
    );

    // Slash command detection in textarea
    const detectSlashCommand = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;

        const cursorPos = el.selectionStart;
        const textBeforeCursor = el.value.slice(0, cursorPos);

        // We only trigger slash command autocomplete if the "/" is at the start of a line
        const lastNewLine = textBeforeCursor.lastIndexOf("\n");
        const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;

        if (textBeforeCursor[lineStart] !== "/") {
            setSlashQuery(null);
            slashTriggerPos.current = null;
            return;
        }

        const slashIndexInLine = lineStart;
        const query = textBeforeCursor.slice(slashIndexInLine + 1);

        if (query.includes(" ")) {
            setSlashQuery(null);
            slashTriggerPos.current = null;
            return;
        }

        slashTriggerPos.current = slashIndexInLine;
        setSlashQuery(query);
        setSlashIndex(0);

        const rect = el.getBoundingClientRect();
        setSlashPos({
            top: rect.top - 4,
            left: rect.left + 12,
        });
    }, []);

    const handleSlashSelect = useCallback(
        (skillName: string) => {
            const el = textareaRef.current;
            if (!el || slashTriggerPos.current === null) return;

            const before = input.slice(0, slashTriggerPos.current);
            const after = input.slice(el.selectionStart);
            const newValue = `${before}/${skillName} ${after}`;

            setInput(newValue);
            setSlashQuery(null);
            slashTriggerPos.current = null;

            const cursorPos = before.length + 1 + skillName.length + 1;
            requestAnimationFrame(() => {
                el.focus();
                el.selectionStart = cursorPos;
                el.selectionEnd = cursorPos;
            });
        },
        [input],
    );

    /** Create a placeholder node for a generation step, collision-aware.
     *  Returns { rect, nodeId } — nodeId is a fresh uuid, NOT step.id,
     *  so multiple runs never produce duplicate canvas node IDs. */
    const addPlaceholderNode = useCallback(
        (
            step: GenerationStep,
            occupiedRects: PlaceholderRect[],
            overridePosition?: { x: number; y: number },
        ): { rect: PlaceholderRect; nodeId: string } => {
            const { width, height } = parseAspectRatioDimensions(
                step.aspectRatio,
            );

            // Find the reference node to position near
            const refNodeId =
                step.referenceNodeIds?.[0] ?? step.firstFrameNodeId;
            const refNode = refNodeId
                ? nodes.find((n) => n.id === refNodeId)
                : null;
            const refRect: PlaceholderRect | null = refNode
                ? {
                      x: refNode.position.x,
                      y: refNode.position.y,
                      w:
                          (refNode.data as { width?: number }).width ??
                          refNode.width ??
                          300,
                      h:
                          (refNode.data as { height?: number }).height ??
                          refNode.height ??
                          300,
                  }
                : null;

            const center = getViewportCenter();
            const position =
                overridePosition ??
                findEmptyPosition(
                    width,
                    height,
                    refRect,
                    occupiedRects,
                    center,
                );

            const nodeId = uuidv4();
            const nodeType =
                step.type === "image"
                    ? "canvas-image"
                    : step.type === "audio"
                      ? "canvas-audio"
                      : "canvas-video";
            const label = step.label ?? getNextLabel(nodeType);

            if (step.type === "image") {
                const data: CanvasImageData = {
                    type: "canvas-image",
                    label,
                    sourceUrl: "",
                    mimeType: "image/png",
                    prompt: step.prompt,
                    width,
                    height,
                    aspectRatio: step.aspectRatio,
                    model: step.model,
                    status: "pending",
                    referenceNodeIds: step.referenceNodeIds,
                };
                addNode({
                    id: nodeId,
                    type: "canvas-image",
                    position,
                    data,
                    width,
                    height,
                });
            } else if (step.type === "audio") {
                const data: CanvasAudioData = {
                    type: "canvas-audio",
                    label,
                    sourceUrl: "",
                    mimeType: "audio/wav",
                    prompt: step.prompt,
                    model: step.model,
                    status: "pending",
                };
                addNode({
                    id: nodeId,
                    type: "canvas-audio",
                    position,
                    data,
                    width: 288,
                    height: 100,
                });
            } else {
                const data: CanvasVideoData = {
                    type: "canvas-video",
                    label,
                    sourceUrl: "",
                    mimeType: "video/mp4",
                    prompt: step.prompt,
                    width,
                    height,
                    aspectRatio: step.aspectRatio,
                    model: step.model,
                    status: "pending",
                    progress: 0,
                    referenceNodeIds: step.referenceNodeIds,
                };
                addNode({
                    id: nodeId,
                    type: "canvas-video",
                    position,
                    data,
                    width,
                    height,
                });
            }

            return {
                rect: { x: position.x, y: position.y, w: width, h: height },
                nodeId,
            };
        },
        [getViewportCenter, addNode, getNextLabel, nodes],
    );

    const executePlanStream = useCallback(
        async (messageId: string, plan: AgentPlan) => {
            if (!canvasId) return;

            setPlanStatus(messageId, "approved");

            // Seed occupied rects and create placeholder nodes
            const occupiedRects: PlaceholderRect[] = useCanvasStore
                .getState()
                .nodes.map((n) => ({
                    x: n.position.x,
                    y: n.position.y,
                    w: (n.data as { width?: number }).width ?? n.width ?? 300,
                    h:
                        (n.data as { height?: number }).height ??
                        n.height ??
                        300,
                }));

            const { positions: computedPositions, center: groupCenter } =
                calculateNodePositions(
                    plan.steps,
                    useCanvasStore.getState().nodes,
                    getViewportCenter(),
                );

            const stepNodeMap = new Map<string, string>();
            let lastImageSourceUrl: string | null = null;

            plan.steps.forEach((s) => {
                setPlanStepStatus(messageId, s.id, "pending");
                const overridePosition = computedPositions.get(s.id);
                const { rect, nodeId } = addPlaceholderNode(
                    s,
                    occupiedRects,
                    overridePosition,
                );
                stepNodeMap.set(s.id, nodeId);
                occupiedRects.push(rect);
            });

            centerOnNodes(groupCenter.x, groupCenter.y);

            try {
                const res = await fetch(
                    `/api/canvases/${canvasId}/execute-plan`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            plan,
                            messageId,
                            musicModel: agentSettings.musicModel,
                        }),
                    },
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(
                        err.error ||
                            `Execute plan request failed (${res.status})`,
                    );
                }

                const reader = res.body?.getReader();
                if (!reader) throw new Error("No response stream");

                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const { events, remaining } = parseSSEEvents(chunk, buffer);
                    buffer = remaining;

                    for (const sse of events) {
                        try {
                            const payload = JSON.parse(sse.data);

                            switch (sse.event) {
                                case "step_start": {
                                    setPlanStepStatus(
                                        messageId,
                                        payload.stepId,
                                        "generating",
                                    );
                                    const startNodeId = stepNodeMap.get(
                                        payload.stepId,
                                    );
                                    if (startNodeId) {
                                        useCanvasStore
                                            .getState()
                                            .updateNodeData(startNodeId, {
                                                status: "generating",
                                            });
                                    }
                                    break;
                                }

                                case "step_done": {
                                    const node = payload.node as NodePayload;
                                    setPlanStepStatus(
                                        messageId,
                                        payload.stepId,
                                        "done",
                                    );
                                    if (
                                        node.type === "canvas-image" &&
                                        node.sourceUrl
                                    ) {
                                        lastImageSourceUrl = node.sourceUrl;
                                    }
                                    const nodeId = stepNodeMap.get(
                                        payload.stepId,
                                    );
                                    if (nodeId) {
                                        const isImageWithRuleset =
                                            node.type === "canvas-image" &&
                                            !!useCanvasStore.getState()
                                                .activeRulesetId;

                                        const {
                                            id: _id,
                                            type: _type,
                                            ...dataFields
                                        } = node;

                                        useCanvasStore
                                            .getState()
                                            .updateNodeData(nodeId, {
                                                ...dataFields,
                                                status: "ready",
                                                ...(node.type === "canvas-video"
                                                    ? { progress: 100 }
                                                    : {}),
                                                // show spinner while validation runs
                                                ...(isImageWithRuleset
                                                    ? { validating: true }
                                                    : {}),
                                            } as Partial<CanvasNodeData>);

                                        const currentMsg = useCanvasStore
                                            .getState()
                                            .messages.find(
                                                (m) => m.id === messageId,
                                            );
                                        const existingRefs: GeneratedMediaRef[] =
                                            currentMsg?.generatedMedia ?? [];
                                        updateMessage(messageId, {
                                            generatedMedia: [
                                                ...existingRefs,
                                                { nodeId, type: node.type },
                                            ],
                                        });
                                    }
                                    break;
                                }

                                case "step_validated": {
                                    const nodeId = stepNodeMap.get(
                                        payload.stepId,
                                    );
                                    if (nodeId) {
                                        useCanvasStore
                                            .getState()
                                            .updateNodeData(nodeId, {
                                                validating: false,
                                                validationResults:
                                                    payload.validationResults,
                                                // replace image if retry produced a new one
                                                ...(payload.node
                                                    ? {
                                                          sourceUrl:
                                                              payload.node
                                                                  .sourceUrl,
                                                          mimeType:
                                                              payload.node
                                                                  .mimeType,
                                                      }
                                                    : {}),
                                            });

                                        const failures =
                                            payload.validationResults.filter(
                                                (r: { status: string }) =>
                                                    r.status === "fail",
                                            );
                                        if (failures.length > 0) {
                                            toast.warning(
                                                `${failures.length} rule${failures.length !== 1 ? "s" : ""} failed — see badge on image for details`,
                                            );
                                        }
                                    }
                                    break;
                                }

                                case "step_error": {
                                    const nodeId = stepNodeMap.get(
                                        payload.stepId,
                                    );
                                    setPlanStepStatus(
                                        messageId,
                                        payload.stepId,
                                        "error",
                                    );
                                    if (nodeId) {
                                        useCanvasStore
                                            .getState()
                                            .updateNodeData(nodeId, {
                                                status: "error",
                                                error: payload.message,
                                            });
                                    }
                                    toast.error(
                                        `Generation failed: ${payload.message}`,
                                    );
                                    break;
                                }

                                case "error":
                                    throw new Error(
                                        payload.message || "Stream error",
                                    );

                                case "done":
                                    if (lastImageSourceUrl) {
                                        fetch(`/api/canvases/${canvasId}`, {
                                            method: "PATCH",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify({
                                                thumbnail: lastImageSourceUrl,
                                            }),
                                        }).catch(() => {});
                                    }
                                    break;
                            }
                        } catch (parseErr) {
                            if (
                                parseErr instanceof Error &&
                                parseErr.message !== "Stream error"
                            ) {
                                console.warn(
                                    "Execute-plan SSE parse error:",
                                    parseErr,
                                );
                            } else {
                                throw parseErr;
                            }
                        }
                    }
                }
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }
                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to execute plan";
                toast.error(message);
            }
        },
        [
            canvasId,
            setPlanStatus,
            setPlanStepStatus,
            addPlaceholderNode,
            updateMessage,
            getViewportCenter,
            centerOnNodes,
            agentSettings.musicModel,
        ],
    );

    // Keep the ref in sync so the plan approval widget can call executePlanStream
    useEffect(() => {
        if (executePlanStreamRef) {
            executePlanStreamRef.current = executePlanStream;
        }
    }, [executePlanStreamRef, executePlanStream]);

    const handleSend = useCallback(
        async (overrideMessage?: string) => {
            const text = overrideMessage ?? input.trim();
            if (!text || isChatLoading || !canvasId) return;

            const isActionPrompt = !!overrideMessage;
            const attachmentsToSend = isActionPrompt ? [] : [...allAttachments];

            const userMessage: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content: text,
                attachments:
                    attachmentsToSend.length > 0
                        ? attachmentsToSend
                        : undefined,
                model: agentSettings.llmModel,
                createdAt: new Date().toISOString(),
            };

            // Auto-cancel any pending plan from a previous message
            const currentMessages = useCanvasStore.getState().messages;
            const pendingPlanMsg = currentMessages.find(
                (m) =>
                    m.role === "assistant" &&
                    m.planStatus === "pending_approval",
            );
            if (pendingPlanMsg) {
                setPlanStatus(pendingPlanMsg.id, "cancelled");
            }

            addMessage(userMessage);
            if (!isActionPrompt) {
                setInput("");
                setMentionedNodeIds(new Set());
                setDismissedNodeIds(new Set());
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                }
            }
            setIsChatLoading(true);

            const assistantMsgId = uuidv4();
            const assistantMessage: ChatMessage = {
                id: assistantMsgId,
                role: "assistant",
                content: "",
                model: agentSettings.llmModel,
                createdAt: new Date().toISOString(),
            };
            addMessage(assistantMessage);

            const abortController = new AbortController();
            abortRef.current = abortController;

            try {
                const res = await fetch(`/api/canvases/${canvasId}/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: text,
                        sessionId,
                        attachments:
                            attachmentsToSend.length > 0
                                ? attachmentsToSend
                                : undefined,
                        mode: agentSettings.mode,
                        model: agentSettings.llmModel,
                        imageDefaults: {
                            model: agentSettings.imageModel,
                            ...(agentSettings.imageAspectRatio !== "auto" && {
                                aspectRatio: agentSettings.imageAspectRatio,
                            }),
                            ...(agentSettings.imageResolution !== "auto" && {
                                imageSize: agentSettings.imageResolution,
                            }),
                        },
                        videoDefaults: {
                            model: agentSettings.videoModel,
                            generateAudio: agentSettings.videoGenerateAudio,
                            ...(agentSettings.videoAspectRatio !== "auto" && {
                                aspectRatio: agentSettings.videoAspectRatio,
                            }),
                            ...(agentSettings.videoResolution !== "auto" && {
                                resolution: agentSettings.videoResolution,
                            }),
                            ...(agentSettings.videoDuration !== "auto" && {
                                duration: Number(agentSettings.videoDuration),
                            }),
                        },
                    }),
                    signal: abortController.signal,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(
                        err.error || `Chat request failed (${res.status})`,
                    );
                }

                const reader = res.body?.getReader();
                if (!reader) throw new Error("No response stream");

                const decoder = new TextDecoder();
                let buffer = "";
                let accumulatedText = "";
                let cumulativeThought = "";
                const directorLog: import("@/lib/canvas/types").DirectorLogEntry[] =
                    [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const { events, remaining } = parseSSEEvents(chunk, buffer);
                    buffer = remaining;

                    for (const sse of events) {
                        try {
                            const payload = JSON.parse(sse.data);

                            switch (sse.event) {
                                case "text":
                                    accumulatedText += payload.delta;
                                    updateMessage(assistantMsgId, {
                                        content: accumulatedText,
                                    });
                                    break;

                                case "thought": {
                                    const full: string = payload.delta;
                                    const newPart = full.startsWith(
                                        cumulativeThought,
                                    )
                                        ? full
                                              .slice(cumulativeThought.length)
                                              .trim()
                                        : full;
                                    cumulativeThought = full;
                                    if (newPart) {
                                        directorLog.push({
                                            type: "thought",
                                            text: newPart,
                                        });
                                        updateMessage(assistantMsgId, {
                                            directorLog: [...directorLog],
                                        });
                                    }
                                    break;
                                }

                                case "agent_action":
                                    directorLog.push({
                                        type: "action",
                                        label: payload.label,
                                    });
                                    updateMessage(assistantMsgId, {
                                        directorLog: [...directorLog],
                                    });
                                    break;

                                case "plan": {
                                    const steps =
                                        payload.steps as GenerationStep[];
                                    // Set pending_approval — execution deferred until user confirms
                                    updateMessage(assistantMsgId, {
                                        plan: { steps },
                                        planStatus: "pending_approval",
                                    });
                                    break;
                                }

                                case "actions":
                                    if (payload.actions) {
                                        updateMessage(assistantMsgId, {
                                            actions: payload.actions,
                                        });
                                    }
                                    break;

                                case "text_nodes": {
                                    const textNodes = payload.nodes as Array<{
                                        id: string;
                                        title: string;
                                        content: string;
                                        format?: string;
                                    }>;
                                    const center = getViewportCenter();
                                    const existingNodes =
                                        useCanvasStore.getState().nodes;
                                    const lowestY =
                                        existingNodes.length > 0
                                            ? Math.max(
                                                  ...existingNodes.map(
                                                      (n) =>
                                                          n.position.y +
                                                          ((
                                                              n.data as {
                                                                  height?: number;
                                                              }
                                                          ).height ??
                                                              n.height ??
                                                              300),
                                                  ),
                                              )
                                            : center.y - 300;
                                    textNodes.forEach((tn, idx) => {
                                        const nodeWidth = 480;
                                        const nodeHeight = 600;
                                        const gap = 40;
                                        const position = {
                                            x:
                                                existingNodes.length > 0
                                                    ? center.x - nodeWidth / 2
                                                    : center.x - nodeWidth / 2,
                                            y:
                                                lowestY +
                                                gap +
                                                idx * (nodeHeight + gap),
                                        };
                                        addNode({
                                            id: uuidv4(),
                                            type: "canvas-text",
                                            position,
                                            data: {
                                                type: "canvas-text",
                                                label: tn.title,
                                                content: tn.content,
                                                format: tn.format as
                                                    | "scenario"
                                                    | "synopsis"
                                                    | "brief"
                                                    | "notes"
                                                    | undefined,
                                                width: nodeWidth,
                                                height: nodeHeight,
                                            },
                                            width: nodeWidth,
                                            height: nodeHeight,
                                        });
                                    });
                                    break;
                                }

                                case "question":
                                    updateMessage(assistantMsgId, {
                                        question: payload as QuestionPayload,
                                    });
                                    break;

                                case "error":
                                    throw new Error(
                                        payload.message || "Stream error",
                                    );

                                case "done":
                                    break;
                            }
                        } catch (parseErr) {
                            if (
                                parseErr instanceof Error &&
                                parseErr.message !== "Stream error"
                            ) {
                                console.warn("SSE parse error:", parseErr);
                            } else {
                                throw parseErr;
                            }
                        }
                    }
                }
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }
                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to get response";
                updateMessage(assistantMsgId, {
                    content: assistantMessage.content || `Error: ${message}`,
                });
                toast.error(message);
            } finally {
                setIsChatLoading(false);
                abortRef.current = null;
            }
        },
        [
            input,
            isChatLoading,
            canvasId,
            agentSettings,
            allAttachments,
            sessionId,
            addMessage,
            updateMessage,
            setIsChatLoading,
            setPlanStatus,
            addNode,
            getViewportCenter,
        ],
    );

    // Auto-send when a suggested action button is clicked
    useEffect(() => {
        if (pendingActionPrompt && !isChatLoading) {
            setPendingActionPrompt(null);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            handleSend(pendingActionPrompt);
        }
    }, [
        pendingActionPrompt,
        isChatLoading,
        setPendingActionPrompt,
        handleSend,
    ]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            // Handle slash command autocomplete navigation
            if (slashQuery !== null && filteredSlashSkills.length > 0) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSlashIndex((i) =>
                        Math.min(i + 1, filteredSlashSkills.length - 1),
                    );
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSlashIndex((i) => Math.max(i - 1, 0));
                    return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    handleSlashSelect(filteredSlashSkills[slashIndex]);
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    setSlashQuery(null);
                    slashTriggerPos.current = null;
                    return;
                }
            }

            // Handle mention dropdown navigation
            if (mentionQuery !== null && filteredMentionItems.length > 0) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((i) =>
                        Math.min(i + 1, filteredMentionItems.length - 1),
                    );
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex((i) => Math.max(i - 1, 0));
                    return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    handleMentionSelect(filteredMentionItems[mentionIndex]);
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    closeMention();
                    return;
                }
            }

            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [
            handleSend,
            mentionQuery,
            filteredMentionItems,
            mentionIndex,
            handleMentionSelect,
            closeMention,
            slashQuery,
            filteredSlashSkills,
            slashIndex,
            handleSlashSelect,
        ],
    );

    const handleTextareaChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setInput(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 150)}px`;

            detectMention();
            detectSlashCommand();
        },
        [detectMention, detectSlashCommand],
    );

    const handleTextareaClick = useCallback(() => {
        detectMention();
        detectSlashCommand();
    }, [detectMention, detectSlashCommand]);

    return (
        <div className="border-border rounded-b-lg border-t p-3">
            <div className="bg-muted/50 rounded-md border">
                {/* Style + Ruleset selectors */}
                <div className="flex items-center gap-1 px-2 pt-2 pb-0.5">
                    {/* Style selector */}
                    <DropdownMenu
                        onOpenChange={(open) => {
                            if (!open) {
                                setStyleSearch("");
                            }
                        }}
                    >
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "inline-flex max-w-[160px] items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                                    activeStyleId
                                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                )}
                            >
                                <StyleThumbnail
                                    imageUri={activeStyleImageUrl ?? undefined}
                                />
                                <span className="truncate">
                                    {activeStyleName ?? "Style"}
                                </span>
                                <ChevronDown className="size-2.5 shrink-0 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 p-0">
                            <div className="border-b p-2">
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
                                    <Input
                                        placeholder="Search styles..."
                                        className="h-8 pl-8 text-xs focus-visible:ring-1 focus-visible:ring-violet-500/50"
                                        value={styleSearch}
                                        onChange={(e) =>
                                            setStyleSearch(e.target.value)
                                        }
                                        onKeyDown={(e) => e.stopPropagation()}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-1">
                                {filteredUserStyles.length > 0 && (
                                    <>
                                        <DropdownMenuLabel className="text-xs">
                                            My Styles
                                        </DropdownMenuLabel>
                                        {filteredUserStyles.map((s) => (
                                            <DropdownMenuItem
                                                key={s.id}
                                                onClick={() =>
                                                    handleSelectStyle(s.id)
                                                }
                                                className="gap-3 py-2"
                                            >
                                                <div className="flex w-5 items-center justify-center">
                                                    {activeStyleId === s.id && (
                                                        <Check className="size-3.5" />
                                                    )}
                                                </div>
                                                <StyleThumbnail
                                                    imageUri={
                                                        s
                                                            .referenceImageUris?.[0]
                                                    }
                                                />
                                                <span className="truncate">
                                                    {s.name}
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                {filteredTemplates.length > 0 && (
                                    <>
                                        <DropdownMenuLabel className="text-xs">
                                            Templates
                                        </DropdownMenuLabel>
                                        {filteredTemplates.map((t) => (
                                            <DropdownMenuItem
                                                key={t.id}
                                                onClick={() =>
                                                    handleSelectStyle(t.id)
                                                }
                                                className="gap-3 py-2"
                                            >
                                                <div className="flex w-5 items-center justify-center">
                                                    {activeStyleId === t.id && (
                                                        <Check className="size-3.5" />
                                                    )}
                                                </div>
                                                <StyleThumbnail
                                                    imageUri={
                                                        t
                                                            .referenceImageUris?.[0]
                                                    }
                                                />
                                                <span className="truncate">
                                                    {t.name}
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                    </>
                                )}
                                {filteredUserStyles.length === 0 &&
                                    filteredTemplates.length === 0 && (
                                        <div className="text-muted-foreground p-4 text-center text-xs">
                                            No styles found
                                        </div>
                                    )}
                                {activeStyleId && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={handleClearStyle}
                                            className="text-muted-foreground"
                                        >
                                            No style
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Ruleset selector */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "inline-flex max-w-[160px] items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                                    activeRulesetId
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                )}
                            >
                                <RulesetThumbnail active={!!activeRulesetId} />
                                <span className="truncate">
                                    {activeRulesetName ?? "Ruleset"}
                                </span>
                                <ChevronDown className="size-2.5 shrink-0 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                            {userRulesets.length === 0 ? (
                                <div className="text-muted-foreground px-2 py-1.5 text-xs">
                                    No rulesets yet
                                </div>
                            ) : (
                                <>
                                    <DropdownMenuLabel className="text-xs">
                                        My Rulesets
                                    </DropdownMenuLabel>
                                    {userRulesets.map((r) => (
                                        <DropdownMenuItem
                                            key={r.id}
                                            onClick={() =>
                                                void handleSelectRuleset(
                                                    r.id,
                                                    r.name,
                                                )
                                            }
                                            className="gap-3 py-2"
                                        >
                                            <div className="flex w-5 items-center justify-center">
                                                {activeRulesetId === r.id && (
                                                    <Check className="size-3.5" />
                                                )}
                                            </div>
                                            <RulesetThumbnail
                                                active={
                                                    activeRulesetId === r.id
                                                }
                                            />
                                            <span className="truncate">
                                                {r.name}
                                            </span>
                                        </DropdownMenuItem>
                                    ))}
                                </>
                            )}
                            {activeRulesetId && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() =>
                                            void handleClearRuleset()
                                        }
                                        className="text-muted-foreground"
                                    >
                                        No ruleset
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <CanvasAttachmentBar
                    attachments={allAttachments}
                    onRemove={handleRemoveAttachment}
                />

                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        onClick={handleTextareaClick}
                        placeholder={
                            allAttachments.length > 0
                                ? "Describe what to do with the selected items..."
                                : "Describe what you want to create... (@ to mention)"
                        }
                        disabled={isChatLoading}
                        rows={1}
                        className="placeholder:text-muted-foreground w-full resize-none bg-transparent px-3 pt-3 pb-2 text-sm outline-none disabled:opacity-50"
                    />

                    {mentionQuery !== null &&
                        filteredMentionItems.length > 0 && (
                            <CanvasMentionDropdown
                                items={filteredMentionItems}
                                query={mentionQuery}
                                selectedIndex={mentionIndex}
                                position={mentionPos}
                                onSelect={handleMentionSelect}
                                onHover={setMentionIndex}
                            />
                        )}

                    {slashQuery !== null && filteredSlashSkills.length > 0 && (
                        <CanvasSlashAutocomplete
                            items={filteredSlashSkills}
                            query={slashQuery}
                            selectedIndex={slashIndex}
                            position={slashPos}
                            onSelect={handleSlashSelect}
                            onHover={setSlashIndex}
                        />
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <CanvasAgentSettingsDialog
                        settings={agentSettings}
                        onSettingsChange={setAgentSettings}
                    />

                    <Button
                        size="icon-sm"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isChatLoading}
                        className="shrink-0 rounded-md"
                    >
                        {isChatLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <SendHorizonal className="size-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Placeholder positioning utilities ───────────────────────────────────────

interface PlaceholderRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const GAP = 20;
const BASE_AREA = 90_000; // ~300×300 px²

function parseAspectRatioDimensions(aspectRatio?: string): {
    width: number;
    height: number;
} {
    if (!aspectRatio) return { width: 300, height: 300 };
    const [wStr, hStr] = aspectRatio.split(":");
    const wRatio = parseFloat(wStr);
    const hRatio = parseFloat(hStr);
    if (!wRatio || !hRatio) return { width: 300, height: 300 };
    const width = Math.round(Math.sqrt(BASE_AREA * (wRatio / hRatio)));
    const height = Math.round(BASE_AREA / width);
    return { width, height };
}

function rectsOverlap(a: PlaceholderRect, b: PlaceholderRect): boolean {
    return !(
        a.x + a.w + GAP <= b.x ||
        b.x + b.w + GAP <= a.x ||
        a.y + a.h + GAP <= b.y ||
        b.y + b.h + GAP <= a.y
    );
}

function isPositionFree(
    candidate: PlaceholderRect,
    occupied: PlaceholderRect[],
): boolean {
    return !occupied.some((r) => rectsOverlap(candidate, r));
}

/**
 * Find an empty canvas position for a new placeholder node.
 * Tries positions around the reference rect first (right, below, left, above),
 * then spirals outward in a grid from the anchor point.
 */
function findEmptyPosition(
    w: number,
    h: number,
    ref: PlaceholderRect | null,
    occupied: PlaceholderRect[],
    viewportCenter: { x: number; y: number },
): { x: number; y: number } {
    const anchor = ref
        ? { x: ref.x + ref.w / 2, y: ref.y + ref.h / 2 }
        : viewportCenter;

    // Priority candidates around the reference rect
    if (ref) {
        const candidates = [
            // Right
            { x: ref.x + ref.w + GAP, y: ref.y + (ref.h - h) / 2 },
            // Below
            { x: ref.x + (ref.w - w) / 2, y: ref.y + ref.h + GAP },
            // Left
            { x: ref.x - w - GAP, y: ref.y + (ref.h - h) / 2 },
            // Above
            { x: ref.x + (ref.w - w) / 2, y: ref.y - h - GAP },
        ];
        for (const pos of candidates) {
            const rect = { x: pos.x, y: pos.y, w, h };
            if (isPositionFree(rect, occupied)) return pos;
        }
    }

    // Spiral outward in a grid from the anchor
    const step = Math.max(w, h) + GAP;
    for (let ring = 0; ring <= 20; ring++) {
        if (ring === 0) {
            const pos = { x: anchor.x - w / 2, y: anchor.y - h / 2 };
            if (isPositionFree({ x: pos.x, y: pos.y, w, h }, occupied))
                return pos;
            continue;
        }
        // Walk the perimeter of the ring
        for (let dx = -ring; dx <= ring; dx++) {
            for (let dy = -ring; dy <= ring; dy++) {
                if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
                const pos = {
                    x: anchor.x - w / 2 + dx * step,
                    y: anchor.y - h / 2 + dy * step,
                };
                if (isPositionFree({ x: pos.x, y: pos.y, w, h }, occupied))
                    return pos;
            }
        }
    }

    // Absolute fallback (should never reach here)
    return { x: anchor.x - w / 2, y: anchor.y - h / 2 };
}
