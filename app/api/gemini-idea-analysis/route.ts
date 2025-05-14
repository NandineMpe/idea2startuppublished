import { NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"

// Default sections structure
const defaultSections = [
  {
    title: "1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "2. MARKET NEED & DEMAND DYNAMICS",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "3. ALTERNATIVES & CUSTOMER SENTIMENT",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "4. USER BENEFITS & STRATEGIC GAP ANALYSIS",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "5. TRENDS & ENABLING TECHNOLOGIES",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "6. RISK & BARRIER ASSESSMENT",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "7. MONETIZATION & BUSINESS MODEL VALIDATION",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "8. TIMING & COMPETITION",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "9. MACROFORCES (Regulatory, Cultural, Economic, Demographic)",
    content: "Analysis not available due to an error. Please try again later.",
  },
  {
    title: "10. CONCLUSIONS & RECOMMENDATIONS",
    content: "Analysis not available due to an error. Please try again later.",
  },
]

// The updated system prompt for the Gemini analysis with the new contextual prompt
const SYSTEM_PROMPT = `You are about to perform a comprehensive analysis of a proposed startup idea. Your goal is to determine whether the idea solves a real, pressing market problem, whether the timing is right, and what would need to be true for this idea to succeed.

The user will provide the following:
- What idea are you thinking about?
- What solution are you thinking of?
- Who is it for?
- Where is it for?

You must then follow the structured diagnostic framework below and execute research using Gemini's browsing and summarization tools.

You are a multi-disciplinary startup analyst trained in venture strategy, behavioral economics, AI technology trends, global commerce, and market validation frameworks. Your responses must demonstrate rigorous analytical thinking, with an emphasis on structured reasoning, layered synthesis, and source triangulation.

You must apply the following principles at all times:

• **Depth Over Brevity**: All sections must exceed 1500 characters and offer in-depth, multi-layered insight. Avoid shallow summaries.

• **Chain-of-Thought Reasoning**: Work step-by-step through the logic in plain language, using natural internal monologue and structured headings.

• **Step-Back Prompting**: Begin each section with general reflection and relevant frameworks, then narrow to the case-specific analysis.

• **Source Evaluation**: Use only reputable, up-to-date sources. Prioritize academic, government, or verified commercial data (e.g., McKinsey, BCG, Crunchbase, G2, Gartner, etc.)

• **Critical Evaluation**: At every turn, ask: What assumptions am I making? What might be missing or misleading? What must be true for this to succeed?

Do not write like a chatbot. Write like a senior analyst preparing a due diligence report for an investment committee.

# =============== STRUCTURE YOUR RESPONSE ================
Your deliverable must be structured using the following high-level sections:

---

## 1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION
Within this section, include clearly marked subheadings for:
- Problem Type Classification (Blatant, Latent, Aspirational, or Critical)
- Pain Frequency Matrix (High/Low Frequency × High/Low Severity)
- Problem Origin Analysis (personal pain, market gap, new trend, domain expertise)
- Root Cause Analysis ("5 Whys" technique)
- Public Forum Validation (Reddit, Quora, etc.)
- Core Hypothesis Statement (What belief does this idea rely on?)

## 2. MARKET NEED & DEMAND DYNAMICS
Within this section, include clearly marked subheadings for:
- Search Volume & Trend Analysis (Google Trends, Reddit, TikTok)
- Pricing Disparity Assessment
- Customer Outcome Mapping (functional, emotional, social outcomes)
- Adoption Readiness Level (ARL) Analysis
- Demand Trend Analysis (increasing/decreasing patterns)

## 3. ALTERNATIVES & CUSTOMER SENTIMENT
Within this section, include clearly marked subheadings for:
- Competitive Landscape Analysis:
  - Direct Competitors (same solution)
  - Indirect Substitutes (different solution to same problem)
  - Status Quo (manual or inefficient workarounds)
- Sentiment Analysis Methodology
- Review Source Analysis:
  - B2C: Reddit, Twitter/X, TikTok, Trustpilot
  - B2B: G2, Capterra, LinkedIn
- Unmet Needs & Complaint Patterns
- Switching Friction Assessment

## 4. USER BENEFITS & STRATEGIC GAP ANALYSIS
Within this section, include clearly marked subheadings for:
- Functional Utility Definition
- Emotional & Social Rewards
- Underserved Customer Segments
- Strategic Opportunity Identification
- Blue Ocean Strategy Application
- Delivery Model Innovation Assessment

## 5. TRENDS & ENABLING TECHNOLOGIES
Within this section, include clearly marked subheadings for:
- Trend Validation (Google Trends, CB Insights, Gartner)
- Enabling Technology Assessment (AI, APIs, logistics, NLP, etc.)
- Market Failure Analysis (tech maturity, logistics gaps, regulatory issues)
- Trend Alignment Analysis:
  - Macrotrend Alignment
  - Cultural Alignment
  - Demographic Concentration

## 6. RISK & BARRIER ASSESSMENT
Within this section, include clearly marked subheadings for:
- Startup-Specific Risk Analysis:
  - Market Risk (no real need)
  - Technical Risk (integration complexity)
  - Team Risk (missing skills)
  - Financial Risk (CAC, LTV, development runway)
- Entry Barrier Evaluation
- Switching Friction Assessment

## 7. MONETIZATION & BUSINESS MODEL VALIDATION
Within this section, include clearly marked subheadings for:
- Revenue Model Proposals:
  - Transaction-based
  - Subscription
  - AI concierge upsell
  - Aggregator/affiliate hybrid
- CAC/LTV Analysis
- Customer Acquisition Strategy
- Payback Window Assessment

## 8. TIMING & COMPETITION
Within this section, include clearly marked subheadings for:
- Competitor & Case Study Review:
  - Failory Startup Failure Analysis
  - Starter Story & YourStory Case Studies
  - Crunchbase Active Insurgent Analysis
- Market Timing Assessment
- Novel vs. Market-Proven Model Analysis
- Window of Opportunity Analysis

## 9. MACROFORCES (Regulatory, Cultural, Economic, Demographic)
Within this section, include clearly marked subheadings for:
- Regulatory Environment Analysis
- Cultural & Social Trend Impact
- Economic Factor Assessment
- Demographic Pattern Relevance
- Geopolitical Considerations (if applicable)

## 10. CONCLUSIONS & RECOMMENDATIONS
Within this section, include clearly marked subheadings for:
- Viability Assessment
- Commercial Feasibility Analysis
- Strongest Entry Point Recommendation
- Validation Experiment Proposals
- Final Verdict & Actionable Pathways

---

# ========= AGENTIC CAPABILITIES =========
Use your agentic capabilities to enhance your analysis:

1. Browse live sources to gather current market data, trends, and competitive intelligence
2. Read and analyze long-form articles and startup case studies from sources like Failory, YourStory, and Starter Story
3. Pull structured reviews from sites like G2, TrustRadius, Amazon, Reddit, Twitter, LinkedIn, and ProductHunt
4. Parse social sentiment, trend data, and technology forecasts to inform your analysis
5. Conduct multi-hop reasoning to connect insights across different domains and sources

# ========= INPUT FORMAT =========
User will provide:
- Idea Description (What idea are you thinking about?)
- Proposed Solution (What solution are you thinking of?)
- Intended Users (Who is it for?)
- Geographic Focus (Where is it for?)

# ========== OUTPUT FORMAT ==========
Each section must be detailed, referenced, and contain analytical sub-points with clearly marked subheadings. Use bullets, numbered lists, and emphasis to highlight key points. Avoid surface-level synthesis. Responses should reflect strategic acuity, systems thinking, and rigorous evaluation.

Your response should be structured with clear section headers and content. Use the following format:

## 1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION
Your analysis here with clearly marked subheadings...

## 2. MARKET NEED & DEMAND DYNAMICS
Your analysis here with clearly marked subheadings...

## 3. ALTERNATIVES & CUSTOMER SENTIMENT
Your analysis here with clearly marked subheadings...

And so on for all 10 sections.

Make sure each section is clearly separated and labeled with its number and title exactly as shown above.

IMPORTANT: Do not use markdown formatting within the content of each section. Write in plain text without asterisks, hashtags, or other markdown syntax. Use regular paragraphs with line breaks for structure.
`

// Function to clean markdown from text
function cleanMarkdown(text: string): string {
  return (
    text
      // Remove heading markers
      .replace(/#{1,6}\s/g, "")
      // Remove bold/italic markers
      .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
      // Remove underscores for emphasis
      .replace(/_{1,3}(.*?)_{1,3}/g, "$1")
      // Remove bullet points
      .replace(/^\s*[-*+]\s/gm, "")
      // Remove numbered lists but keep the numbers
      .replace(/^\s*(\d+)\.\s/gm, "$1. ")
      // Remove blockquotes
      .replace(/^\s*>\s/gm, "")
      // Remove code blocks but keep content
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```(?:\w+)?\n([\s\S]*?)\n```/g, "$1").trim()
      })
      // Remove inline code but keep content
      .replace(/`([^`]+)`/g, "$1")
      // Normalize multiple newlines to double newlines
      .replace(/\n{3,}/g, "\n\n")
      // Trim whitespace
      .trim()
  )
}

// Function to extract sections from text response
function extractSectionsFromText(text: string) {
  try {
    const sections = []
    const sectionRegex = /## (\d+\.\s+[A-Z\s&()]+)\n([\s\S]*?)(?=## \d+\.|$)/g
    let match

    while ((match = sectionRegex.exec(text)) !== null) {
      const title = match[1].trim()
      const content = cleanMarkdown(match[2].trim())
      sections.push({ title, content })
    }

    if (sections.length > 0) {
      return { sections }
    }

    return null
  } catch (error) {
    console.error("Failed to extract sections from text:", error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    // Set CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers })
    }

    // Parse the request body
    const requestBody = await request.text()
    let body

    try {
      body = JSON.parse(requestBody)
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError)
      return NextResponse.json(
        {
          error: "Invalid request body",
          analysis: {
            sections: defaultSections,
          },
        },
        { headers },
      )
    }

    const { ideaDescription, proposedSolution, intendedUsers, geographicFocus } = body

    // Validate required fields
    if (!ideaDescription) {
      return NextResponse.json(
        {
          error: "Problem description is required",
          analysis: {
            sections: defaultSections,
          },
        },
        { headers },
      )
    }

    // Check if API key is available
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error("Google Gemini API key is not configured")
      return NextResponse.json(
        {
          error: "Google Gemini API key is not configured. Please set the GOOGLE_GEMINI_API_KEY environment variable.",
          analysis: {
            sections: defaultSections,
          },
        },
        { headers },
      )
    }

    // Check if the idea description is too long
    if (ideaDescription.length > 5000) {
      return NextResponse.json(
        {
          error: "Problem description is too long. Please keep it under 5000 characters.",
          analysis: {
            sections: defaultSections,
          },
        },
        { headers },
      )
    }

    // Initialize the Gemini API client
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)

    // Configure Gemini 2.5 Pro with specified parameters
    // Note: Removed the tools configuration that was causing the error
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      // Removed the tools configuration that was causing the error
    })

    // Prepare the prompt with all available information
    const prompt = `
${SYSTEM_PROMPT}

Idea Description (What idea are you thinking about?): ${ideaDescription}
${proposedSolution ? `Proposed Solution (What solution are you thinking of?): ${proposedSolution}` : ""}
${intendedUsers ? `Intended Users (Who is it for?): ${intendedUsers}` : ""}
${geographicFocus ? `Geographic Focus (Where is it for?): ${geographicFocus}` : ""}
`

    try {
      // Call Gemini API for analysis with extended timeout
      const result = (await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out after 5 minutes")), 300000)),
      ])) as any

      const response = await result.response
      const text = response.text()

      if (!text) {
        throw new Error("Empty response from Gemini API")
      }

      // Extract sections from the response
      const analysis = extractSectionsFromText(text)

      // If extraction failed, create a structured response manually
      if (!analysis || !analysis.sections || analysis.sections.length === 0) {
        console.log("Section extraction failed, structuring response manually")

        // Create a structured response based on the section titles
        const structuredSections = defaultSections.map((defaultSection) => {
          const sectionTitle = defaultSection.title
          const titleRegex = new RegExp(
            `${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(?=\\d+\\.|$)`,
            "i",
          )
          const match = text.match(titleRegex)

          return {
            title: sectionTitle,
            content: match ? cleanMarkdown(match[0].replace(sectionTitle, "").trim()) : defaultSection.content,
          }
        })

        return NextResponse.json({ analysis: { sections: structuredSections } }, { headers })
      }

      // Return the analysis
      return NextResponse.json({ analysis }, { headers })
    } catch (apiError) {
      console.error("API error:", apiError)

      // Return a fallback analysis with detailed error information
      return NextResponse.json(
        {
          error: apiError instanceof Error ? apiError.message : "Unknown API error",
          analysis: {
            sections: defaultSections,
          },
        },
        { headers },
      )
    }
  } catch (error) {
    console.error("Error analyzing business idea:", error)

    // Always return a valid JSON response with detailed error information
    return NextResponse.json(
      {
        error: "Failed to analyze business idea",
        details: error instanceof Error ? error.message : "Unknown error",
        analysis: {
          sections: defaultSections,
        },
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    )
  }
}
