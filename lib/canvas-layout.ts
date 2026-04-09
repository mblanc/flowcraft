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
 * Implements Strategy 2 with Downward collision avoidance.
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
    const childrenMap = new Map<string, string[]>();
    const parentsMap = new Map<string, string[]>();

    steps.forEach((step) => {
        if (step.dependsOn) {
            step.dependsOn.forEach((parentId) => {
                const children = childrenMap.get(parentId) || [];
                children.push(step.id);
                childrenMap.set(parentId, children);

                const parents = parentsMap.get(step.id) || [];
                parents.push(parentId);
                parentsMap.set(step.id, parents);
            });
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

    // Temporary storage for calculated positions before collision avoidance
    const idealPositions = new Map<string, { x: number; y: number }>();

    // Helper to layout a subtree
    function layoutNode(
        stepId: string,
        startX: number,
        centerY: number,
    ): number {
        const size = nodeSizes.get(stepId) || {
            width: DEFAULT_NODE_WIDTH,
            height: DEFAULT_NODE_HEIGHT,
        };
        const x = startX;
        const y = centerY - size.height / 2;

        idealPositions.set(stepId, { x, y });

        const children = childrenMap.get(stepId) || [];
        if (children.length === 0) {
            return size.height;
        }

        const childX = x + size.width + GAP_X;
        let totalChildHeight = 0;
        const childSizes: number[] = [];

        children.forEach((childId) => {
            const chSize = nodeSizes.get(childId) || {
                width: DEFAULT_NODE_WIDTH,
                height: DEFAULT_NODE_HEIGHT,
            };
            childSizes.push(chSize.height);
            totalChildHeight += chSize.height;
        });
        totalChildHeight += (children.length - 1) * GAP_Y;

        let currentY = centerY - totalChildHeight / 2;

        children.forEach((childId, index) => {
            const childH = childSizes[index];
            layoutNode(childId, childX, currentY + childH / 2);
            currentY += childH + GAP_Y;
        });

        return Math.max(size.height, totalChildHeight);
    }

    // Layout each root
    let rootY = viewportCenter.y;
    roots.forEach((root) => {
        // Find anchor from reference nodes if available
        let anchorX = viewportCenter.x;
        let anchorY = rootY;

        const refNodeId = root.referenceNodeIds?.[0] || root.firstFrameNodeId;
        const refNode = refNodeId
            ? existingNodes.find((n) => n.id === refNodeId)
            : null;

        if (refNode) {
            anchorX =
                refNode.position.x +
                (refNode.width || DEFAULT_NODE_WIDTH) +
                GAP_X;
            anchorY =
                refNode.position.y +
                (refNode.height || DEFAULT_NODE_HEIGHT) / 2;
        }

        const subtreeHeight = layoutNode(root.id, anchorX, anchorY);
        // If no ref node, shift the next root down to avoid stacking
        if (!refNode) {
            rootY += subtreeHeight + GAP_Y;
        }
    });

    // 3. Collision avoidance (Strategy 2: Subgraph Shifting Downwards)
    if (idealPositions.size > 0) {
        // Calculate bounding box of raw ideal positions
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        idealPositions.forEach((pos, id) => {
            const size = nodeSizes.get(id) || {
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

        // Shift down until the entire bounding box fits
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
                    // Shift down by a step (e.g., 50px or a full node height + gap)
                    shiftedY += 50;
                    break;
                }
            }
            attempts++;
        }

        const deltaX = shiftedX - minX;
        const deltaY = shiftedY - minY;

        // Apply final shifted positions
        idealPositions.forEach((pos, id) => {
            positions.set(id, {
                x: pos.x + deltaX,
                y: pos.y + deltaY,
            });
        });
    }

    return positions;
}

// ─── Utilities adapted from canvas-chat-input ────────────────────────────────

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
