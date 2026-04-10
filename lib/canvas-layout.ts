import type {
    GenerationStep,
    CanvasNode,
    CanvasNodeData,
} from "./canvas-types";

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const GAP_X = 60;
const GAP_Y = 40;
const DEFAULT_NODE_WIDTH = 300;
const DEFAULT_NODE_HEIGHT = 300;

/**
 * Calculates organized positions for new generation steps.
 *
 * Layout rules:
 * - Nodes at the same dependency depth share a vertical column (left-to-right).
 * - Siblings within a column are spaced using the full subtree height so that
 *   descendants never overlap with adjacent subtrees.
 * - Multiple roots that all reference the same existing canvas node are treated
 *   as a group and vertically centered on that reference node.
 * - After ideal positions are computed, the whole group is shifted down until
 *   it no longer overlaps any existing canvas node.
 */
export function calculateNodePositions(
    steps: GenerationStep[],
    existingNodes: CanvasNode[],
    viewportCenter: { x: number; y: number },
): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const nodeSizes = new Map<string, { width: number; height: number }>();

    // Pre-calculate sizes based on aspect ratio or defaults
    steps.forEach((step) => {
        const size = parseAspectRatioDimensions(step.aspectRatio);
        nodeSizes.set(step.id, size);
    });

    // 1. Build dependency graph
    // Each node is assigned to exactly ONE layout parent (first entry in dependsOn)
    // to keep the layout a proper tree and avoid duplicate placement.
    const childrenMap = new Map<string, string[]>();
    const parentsMap = new Map<string, string[]>();

    steps.forEach((step) => {
        if (step.dependsOn && step.dependsOn.length > 0) {
            parentsMap.set(step.id, step.dependsOn);
            // Use only the first parent for layout placement
            const primaryParent = step.dependsOn[0];
            const children = childrenMap.get(primaryParent) ?? [];
            children.push(step.id);
            childrenMap.set(primaryParent, children);
        }
    });

    // 2. Identify roots (steps with no dependsOn within the plan)
    const roots = steps.filter(
        (step) => !step.dependsOn || step.dependsOn.length === 0,
    );

    // Track occupied areas (existing nodes)
    const occupiedRects: Rect[] = existingNodes.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        width:
            (n.data as CanvasNodeData).width || n.width || DEFAULT_NODE_WIDTH,
        height:
            (n.data as CanvasNodeData).height ||
            n.height ||
            DEFAULT_NODE_HEIGHT,
    }));

    // Ideal positions computed before collision avoidance
    const idealPositions = new Map<string, { x: number; y: number }>();

    // 3. Subtree height cache — computes the full recursive height a subtree
    //    needs vertically so that siblings are spaced without overlap.
    const subtreeHeightCache = new Map<string, number>();

    function computeSubtreeHeight(stepId: string): number {
        if (subtreeHeightCache.has(stepId))
            return subtreeHeightCache.get(stepId)!;
        const size = nodeSizes.get(stepId) ?? {
            width: DEFAULT_NODE_WIDTH,
            height: DEFAULT_NODE_HEIGHT,
        };
        const children = childrenMap.get(stepId) ?? [];
        if (children.length === 0) {
            subtreeHeightCache.set(stepId, size.height);
            return size.height;
        }
        const childrenTotal =
            children.reduce((sum, c) => sum + computeSubtreeHeight(c), 0) +
            (children.length - 1) * GAP_Y;
        const h = Math.max(size.height, childrenTotal);
        subtreeHeightCache.set(stepId, h);
        return h;
    }

    // 4. Recursive layout — places a node and all its descendants.
    //    startX: left edge of this node's column
    //    centerY: vertical center of the slot allocated to this subtree
    function layoutNode(stepId: string, startX: number, centerY: number): void {
        const size = nodeSizes.get(stepId) ?? {
            width: DEFAULT_NODE_WIDTH,
            height: DEFAULT_NODE_HEIGHT,
        };
        idealPositions.set(stepId, {
            x: startX,
            y: centerY - size.height / 2,
        });

        const children = childrenMap.get(stepId) ?? [];
        if (children.length === 0) return;

        const childX = startX + size.width + GAP_X;

        // Use subtree heights so each child's slot is large enough to contain
        // that child plus all its descendants without overlapping siblings.
        const totalChildrenH =
            children.reduce((sum, c) => sum + computeSubtreeHeight(c), 0) +
            (children.length - 1) * GAP_Y;

        let currentY = centerY - totalChildrenH / 2;

        children.forEach((childId) => {
            const childSlotH = computeSubtreeHeight(childId);
            layoutNode(childId, childX, currentY + childSlotH / 2);
            currentY += childSlotH + GAP_Y;
        });
    }

    // 5. Group roots by their reference anchor node so that multiple independent
    //    steps referencing the same existing node are vertically centered on it
    //    rather than all being placed at the same Y.
    const rootGroups = new Map<string, GenerationStep[]>();
    roots.forEach((root) => {
        const refKey =
            root.referenceNodeIds?.[0] ?? root.firstFrameNodeId ?? "__free__";
        const group = rootGroups.get(refKey) ?? [];
        group.push(root);
        rootGroups.set(refKey, group);
    });

    let freeRootY = viewportCenter.y;

    rootGroups.forEach((group, refKey) => {
        const refNode =
            refKey !== "__free__"
                ? (existingNodes.find((n) => n.id === refKey) ?? null)
                : null;

        const totalGroupH =
            group.reduce((sum, r) => sum + computeSubtreeHeight(r.id), 0) +
            (group.length - 1) * GAP_Y;

        let anchorX: number;
        let groupCenterY: number;

        if (refNode) {
            anchorX =
                refNode.position.x +
                (refNode.width ?? DEFAULT_NODE_WIDTH) +
                GAP_X;
            groupCenterY =
                refNode.position.y +
                (refNode.height ?? DEFAULT_NODE_HEIGHT) / 2;
        } else {
            anchorX = viewportCenter.x;
            groupCenterY = freeRootY + totalGroupH / 2;
            freeRootY += totalGroupH + GAP_Y;
        }

        let currentY = groupCenterY - totalGroupH / 2;
        group.forEach((root) => {
            const rootSlotH = computeSubtreeHeight(root.id);
            layoutNode(root.id, anchorX, currentY + rootSlotH / 2);
            currentY += rootSlotH + GAP_Y;
        });
    });

    // 6. Collision avoidance — shift the entire new group downward until it no
    //    longer overlaps any existing canvas node.
    if (idealPositions.size > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        idealPositions.forEach((pos, id) => {
            const size = nodeSizes.get(id) ?? {
                width: DEFAULT_NODE_WIDTH,
                height: DEFAULT_NODE_HEIGHT,
            };
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + size.width);
            maxY = Math.max(maxY, pos.y + size.height);
        });

        const groupW = maxX - minX;
        const groupH = maxY - minY;

        const shiftedX = minX;
        let shiftedY = minY;

        let hasCollision = true;
        let attempts = 0;
        const MAX_ATTEMPTS = 100;

        while (hasCollision && attempts < MAX_ATTEMPTS) {
            hasCollision = false;
            const groupRect: Rect = {
                x: shiftedX,
                y: shiftedY,
                width: groupW,
                height: groupH,
            };

            for (const occ of occupiedRects) {
                if (rectsOverlap(groupRect, occ)) {
                    hasCollision = true;
                    shiftedY += 50;
                    break;
                }
            }
            attempts++;
        }

        const deltaY = shiftedY - minY;

        idealPositions.forEach((pos, id) => {
            positions.set(id, {
                x: pos.x,
                y: pos.y + deltaY,
            });
        });
    }

    return positions;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const BASE_AREA = 90_000; // ~300×300 px²

function parseAspectRatioDimensions(aspectRatio?: string): {
    width: number;
    height: number;
} {
    if (!aspectRatio)
        return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
    const [wStr, hStr] = aspectRatio.split(":");
    const wRatio = parseFloat(wStr);
    const hRatio = parseFloat(hStr);
    if (!wRatio || !hRatio)
        return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
    const width = Math.round(Math.sqrt(BASE_AREA * (wRatio / hRatio)));
    const height = Math.round(BASE_AREA / width);
    return { width, height };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
    const PADDING = 20; // Extra padding between nodes
    return !(
        a.x + a.width + PADDING <= b.x ||
        b.x + b.width + PADDING <= a.x ||
        a.y + a.height + PADDING <= b.y ||
        b.y + b.height + PADDING <= a.y
    );
}
