import { Firestore } from "@google-cloud/firestore"

// Initialize Firestore client
let firestore: Firestore | null = null

export function getFirestore(): Firestore {
  if (!firestore) {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      databaseId: process.env.FIRESTORE_DATABASE_ID,
      // Add connection pooling settings
      maxIdleTime: 0,        // 30 seconds
      maxConcurrency: 100,       // Max concurrent requests
      keepAlive: true,    
    })
  }
  return firestore
}

export interface FlowDocument {
  id: string
  userId: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  thumbnail?: string
  createdAt: Date
  updatedAt: Date
}

export const COLLECTIONS = {
  FLOWS: "flows",
} as const
