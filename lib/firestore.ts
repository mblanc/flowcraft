import { Firestore } from "@google-cloud/firestore";
import { config } from "./config";

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
    nodes: unknown[];
    edges: unknown[];
    thumbnail?: string;
    createdAt: Date;
    updatedAt: Date;
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
    nodes: unknown[];
    edges: unknown[];
    thumbnail?: string;
    inputs: CustomNodePort[];
    outputs: CustomNodePort[];
    createdAt: Date;
    updatedAt: Date;
}
