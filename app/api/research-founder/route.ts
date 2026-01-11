
import { NextResponse } from "next/server"
import { searchFounder } from "@/lib/exa"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(req: Request) {
    try {
        const { name, linkedinUrl } = await req.json()

        if (!name && !linkedinUrl) {
            return NextResponse.json({ error: "Name or LinkedIn URL required" }, { status: 400 })
        }

        // 1. Search via Exa
        const query = linkedinUrl || `Founder ${name}`
        const searchResults = await searchFounder(query)

        if (!searchResults || searchResults.length === 0) {
            return NextResponse.json({ error: "No public information found" }, { status: 404 })
        }

        // 2. Synthesize with Gemini
        const context = searchResults.map((r: any) => r.text).join("\n\n")

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" })

        const prompt = `
      You are an expert researcher. Based on the following public search results about a founder:
      
      ${context}
      
      Extract and structure the following information in JSON format:
      1. industryExperience (summary of their past roles)
      2. relevantProjects (key startups or projects they built)
      3. personalExperience (a brief bio/story)
      
      Keep it concise but detailed enough to be useful for a "Founder Story" generator.
    `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        // Simple parsing - relying on Gemini to output valid JSON-ish or just plain text if we asked for JSON but it wraps it in markdown blocks
        // Let's try to extract JSON
        let cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim()
        let data
        try {
            data = JSON.parse(cleanedText)
        } catch (e) {
            // Fallback if not valid JSON
            data = { summary: text }
        }

        return NextResponse.json(data)

    } catch (error) {
        console.error("Founder research error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
