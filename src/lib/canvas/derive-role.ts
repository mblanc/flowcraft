import type { CanvasDocument } from "@/lib/canvas/types";

export type CanvasRole = "owner" | "editor" | "viewer";

export function deriveCanvasRole(
    canvas: CanvasDocument,
    userId: string | undefined,
    userEmail: string | undefined | null,
): CanvasRole {
    if (canvas.userId === userId) return "owner";
    const entry = canvas.sharedWith.find((s) => s.email === userEmail);
    if (entry) return entry.role === "edit" ? "editor" : "viewer";
    return "viewer";
}
