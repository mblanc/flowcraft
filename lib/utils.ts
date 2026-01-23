import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function isTypeCompatible(source: string, target: string): boolean {
    if (source === "any" || target === "any") return true;
    return source === target;
}

export function shallowEqual(objA: unknown, objB: unknown) {
    if (Object.is(objA, objB)) return true;
    if (
        typeof objA !== "object" ||
        objA === null ||
        typeof objB !== "object" ||
        objB === null
    ) {
        return false;
    }
    const recordA = objA as Record<string, unknown>;
    const recordB = objB as Record<string, unknown>;
    const keysA = Object.keys(recordA);
    const keysB = Object.keys(recordB);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
        if (
            !Object.prototype.hasOwnProperty.call(recordB, keysA[i]) ||
            !Object.is(recordA[keysA[i]], recordB[keysA[i]])
        ) {
            return false;
        }
    }
    return true;
}
