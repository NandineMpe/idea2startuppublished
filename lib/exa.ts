
import Exa from "exa-js"

const EXA_API_KEY = process.env.EXA_API_KEY || "32fba0d1-bc0e-4aeb-b0c1-acdaa0fb5986"

export const exa = new Exa(EXA_API_KEY)

export async function searchFounder(query: string) {
    try {
        const result = await exa.searchAndContents(
            query + " linkedin profile or biography or founder story",
            {
                type: "neural",
                useAutoprompt: true,
                numResults: 2,
                text: true
            }
        )
        return result.results
    } catch (error) {
        console.error("Exa search error:", error)
        return []
    }
}
