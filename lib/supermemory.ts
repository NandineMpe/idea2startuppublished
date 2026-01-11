
// import { SupermemoryClient } from "supermemory"; // SDK causing build issues
// Replicating SDK functionality with raw fetch

const SUPERMEMORY_API_URL = "https://api.supermemory.ai";
const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY || "sm_Y5EdXMcTdAFUUTycFevS3m_wUyMRSqZZrBkrvQNFqvwBENWZmcaOSwPfnYNAXLidwBOBNyOiJqqSsEZJUhVAAgy";

// Mocking the client export type if needed, but really we just export functions
export const supermemory = {};

export async function addToMemory(content: string) {
    try {
        const response = await fetch(`${SUPERMEMORY_API_URL}/v1/memorize`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPERMEMORY_API_KEY}`
            },
            body: JSON.stringify({
                content: content
            })
        });

        if (!response.ok) {
            console.error("Supermemory add error:", await response.text());
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to add to memory:", error);
        return null;
    }
}

export async function queryMemory(query: string) {
    try {
        const response = await fetch(`${SUPERMEMORY_API_URL}/v1/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPERMEMORY_API_KEY}`
            },
            body: JSON.stringify({
                query: query,
                top_k: 5
            })
        });

        if (!response.ok) {
            console.error("Supermemory search error:", await response.text());
            return [];
        }

        const data = await response.json();
        // Adjust based on actual response structure which might be { results: [...] } or [...]
        return data.results || data;
    } catch (error) {
        console.error("Failed to query memory:", error);
        return [];
    }
}
