import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function isTypeCompatible(source: string, target: string): boolean {
    if (source === "any" || target === "any") return true;
    return source === target;
}
