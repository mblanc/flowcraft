import { Firestore } from "@google-cloud/firestore";
import { config } from "./config";
import type { PersistedNode, PersistedEdge } from "./schemas";

// Initialize Firestore client
let firestore: Firestore | null = null;

export function getFirestore(): Firestore {
    if (!firestore) {
        firestore = new Firestore({
            projectId: config.PROJECT_ID,
            databaseId: config.FIRESTORE_DATABASE_ID,
            // Add connection pooling settings
            maxIdleTime: 0, // 30 seconds
            maxConcurrency: 100, // Max concurrent requests
            keepAlive: true,
        });
    }
    return firestore;
}

export interface FlowDocument {
    id: string;
    userId: string;
    name: string;
    nodes: PersistedNode[];
    edges: PersistedEdge[];
    thumbnail?: string;
    /** ISO 8601 string — Firestore Timestamps are serialized to strings by transformDoc */
    createdAt: string;
    /** ISO 8601 string — Firestore Timestamps are serialized to strings by transformDoc */
    updatedAt: string;
    visibility: "private" | "public" | "restricted";
    sharedWith?: { email: string; role: "view" | "edit" }[];
    sharedWithEmails?: string[];
    isTemplate?: boolean;
}

export interface CustomNodePort {
    id: string;
    name: string;
    type: string;
}

export interface CustomNodeDocument {
    id: string;
    userId: string;
    name: string;
    nodes: PersistedNode[];
    edges: PersistedEdge[];
    thumbnail?: string;
    inputs: CustomNodePort[];
    outputs: CustomNodePort[];
    createdAt: Date;
    updatedAt: Date;
}
