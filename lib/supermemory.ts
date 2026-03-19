const SUPERMEMORY_API_URL = "https://api.supermemory.ai"
const SUPERMEMORY_API_KEY =
  process.env.SUPERMEMORY_API_KEY ||
  "sm_Y5EdXMcTdAFUUTycFevS3m_wUyMRSqZZrBkrvQNFqvwBENWZmcaOSwPfnYNAXLidwBOBNyOiJqqSsEZJUhVAAgy"

export const supermemory = {}

/**
 * Save content to Supermemory.
 * Pass userId to namespace the memory so each user has their own isolated context.
 */
export async function addToMemory(content: string, userId?: string) {
  try {
    const body: Record<string, unknown> = { content }
    if (userId) {
      // Supermemory supports containers for namespacing
      body.containerTags = [`user:${userId}`]
    }

    const response = await fetch(`${SUPERMEMORY_API_URL}/v1/memorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPERMEMORY_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error("Supermemory add error:", await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("Failed to add to memory:", error)
    return null
  }
}

/**
 * Search Supermemory for relevant context.
 * Pass userId to restrict results to that user's memories only.
 */
export async function queryMemory(query: string, userId?: string) {
  try {
    const body: Record<string, unknown> = { query, top_k: 5 }
    if (userId) {
      body.containerTags = [`user:${userId}`]
    }

    const response = await fetch(`${SUPERMEMORY_API_URL}/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPERMEMORY_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error("Supermemory search error:", await response.text())
      return []
    }

    const data = await response.json()
    return data.results || data
  } catch (error) {
    console.error("Failed to query memory:", error)
    return []
  }
}
