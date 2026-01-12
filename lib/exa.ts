// import Exa from "exa-js" // SDK removed to prevent build issues
// Replicating SDK functionality with raw fetch

const EXA_API_KEY = process.env.EXA_API_KEY || "32fba0d1-bc0e-4aeb-b0c1-acdaa0fb5986"
const EXA_API_URL = "https://api.exa.ai/search"

export async function searchFounder(query: string) {
    try {
        const response = await fetch(EXA_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": EXA_API_KEY
            },
            body: JSON.stringify({
                query: query + " linkedin profile or biography or founder story",
                type: "neural",
                useAutoprompt: true,
                numResults: 2,
                contents: {
                    text: true
                }
            })
        })

        if (!response.ok) {
            console.error("Exa API error:", await response.text())
            // If 404 or others, return empty
            return []
        }

        const data = await response.json()
        return data.results || []
    } catch (error) {
        console.error("Exa search fatal error:", error)
        return []
    }
}
