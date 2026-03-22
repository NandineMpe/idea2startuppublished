const SUPERMEMORY_API_URL = "https://api.supermemory.ai"

function getSupermemoryApiKey(): string | undefined {
  return process.env.SUPERMEMORY_API_KEY
}

export const supermemory = {}

/**
 * Save content to Supermemory.
 * Pass userId to namespace the memory so each user has their own isolated context.
 */
export async function addToMemory(content: string, userId?: string) {
  const apiKey = getSupermemoryApiKey()
  if (!apiKey) {
    console.warn("Supermemory: SUPERMEMORY_API_KEY not set; skipping memorize")
    return null
  }
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
        Authorization: `Bearer ${apiKey}`,
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
export async function queryMemory(query: string, userId?: string, topK = 5) {
  const apiKey = getSupermemoryApiKey()
  if (!apiKey) {
    return []
  }
  try {
    const body: Record<string, unknown> = { query, top_k: topK }
    if (userId) {
      body.containerTags = [`user:${userId}`]
    }

    const response = await fetch(`${SUPERMEMORY_API_URL}/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
