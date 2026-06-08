export interface StyleDocument {
    id: string;
    userId: string;
    name: string;
    description: string;
    content: string;
    referenceImageUris: string[];
    isTemplate?: boolean;
    createdAt: string;
    updatedAt: string;
}
