export interface SkillPhase {
    title: string;
    rules: string;
}

export interface UserSkillDocument {
    id: string;
    userId: string;
    name: string;
    description: string;
    triggerHints: string[];
    phases: SkillPhase[];
    visibility: "private" | "public";
    sharedWith: { email: string; role: "view" | "edit" }[];
    sharedWithEmails: string[];
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
}
