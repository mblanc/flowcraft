export interface UserSkillDocument {
    id: string;
    userId: string;
    name: string;
    description: string;
    instructions: string;
    visibility: "private" | "public";
    sharedWith: { email: string; role: "view" | "edit" }[];
    sharedWithEmails: string[];
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
}
