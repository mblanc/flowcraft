export interface StyleDocument {
    id: string;
    userId: string;
    name: string;
    description: string;
    content: string;
    referenceImageUris: string[];
    visibility: "private" | "public";
    sharedWith: { email: string; role: "view" | "edit" }[];
    sharedWithEmails: string[];
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
}
