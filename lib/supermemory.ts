
import { SupermemoryClient } from "supermemory";

const SUPERMEMORY_API_KEY = "sm_Y5EdXMcTdAFUUTycFevS3m_wUyMRSqZZrBkrvQNFqvwBENWZmcaOSwPfnYNAXLidwBOBNyOiJqqSsEZJUhVAAgy";

export const supermemory = new SupermemoryClient({
    apiKey: process.env.SUPERMEMORY_API_KEY || SUPERMEMORY_API_KEY,
});

export async function addToMemory(content: string) {
    try {
        const memory = await supermemory.createMemory({
            content,
        });
        return memory;
    } catch (error) {
        console.error("Failed to add to memory:", error);
        return null;
    }
}

export async function queryMemory(query: string) {
    try {
        const results = await supermemory.query({
            query,
            topK: 3,
        });
        return results;
    } catch (error) {
        console.error("Failed to query memory:", error);
        return [];
    }
}
