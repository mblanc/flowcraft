import { config } from "@/lib/config";

export function isAdmin(email: string | undefined | null): boolean {
    if (!email) return false;
    const adminEmails = config.ADMIN_EMAILS.split(",").map((e: string) =>
        e.trim().toLowerCase(),
    );
    return adminEmails.includes(email.toLowerCase());
}
