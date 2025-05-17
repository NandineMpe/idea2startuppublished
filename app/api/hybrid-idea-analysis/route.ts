import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Default sections to use as fallback if API calls fail
const defaultSections = [
  {
    title: "1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "2. MARKET NEED & DEMAND DYNAMICS",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "3. ALTERNATIVES & CUSTOMER SENTIMENT",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "4. USER BENEFITS & POTENTIAL GAPS",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "5. TRENDS & TECHNOLOGICAL FORCES",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "6. COMPETITION, INSURGENTS & INCUMBENTS",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "7. RISK & BARRIER ASSESSMENT",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "8. TIMING & GO-TO-MARKET SUITABILITY",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "9. MONETIZATION LOGIC",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
  {
    title: "10. FINAL VERDICT: SHOULD THIS IDEA BE BUILT?",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your API key configuration.",
  },
]

// The system prompt for the hybrid analysis
const SYSTEM_PROMPT = `You are an interdisciplinary analyst combining strategic foresight, venture capital acumen, and behavioural economics. Your role is to conduct a full-spectrum assessment of an early-stage business idea using a hybrid methodology: extract factual and thematic intelligence using DeepSeek and critically analyse findings using OpenAI reasoning chains.

# =============== STRUCTURE YOUR RESPONSE ================
Organize your report under the following structured sections, with deep critical synthesis and relevant data citations:

---

## 1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION
- Classify the idea's origin: personal pain, unmet market gap, trend leverage, or domain expertise.
- Determine problem typology: Blatant / Latent / Aspirational / Critical.
- Map to Pain Frequency Matrix: High/Low Frequency × High/Low Severity.
- Apply the "5 Whys" technique to identify root causes.
- Clearly state the core hypothesis: What belief does this idea rely on?

## 2. MARKET NEED & DEMAND DYNAMICS
- Estimate the importance of the problem for potential users.
- Use search trends, survey data, industry reports, and anecdotal evidence.
- Identify functional, emotional, and social outcomes customers seek.
- Use ARL (Adoption Readiness Level) to assess market's willingness to adopt.
- Examine where demand is increasing/decreasing.

## 3. ALTERNATIVES & CUSTOMER SENTIMENT
- Map direct competitors, indirect substitutes, and status quo behaviours.
- Analyse reviews from:
  - B2C: Reddit, Twitter/X, Amazon, Google, Trustpilot
  - B2B: G2, Capterra, TrustRadius, LinkedIn, ProductHunt
- Identify unmet needs, frequent complaints, and customer switch triggers.
- Use NLP sentiment extraction (positive/negative/neutral + feature-based).
- Determine switching friction.

## 4. USER BENEFITS & POTENTIAL GAPS
- Articulate core benefits: utility, cost savings, time savings, emotional relief.
- Highlight what could delight users (surprise benefits).
- Examine potential friction or resistance.
- Determine underserved niches or overlooked jobs-to-be-done.
- Is this a radical improvement or incremental enhancement?

## 5. TRENDS & TECHNOLOGICAL FORCES
- Identify relevant trends: social, regulatory, technological, demographic.
- Analyse enabling technologies: AI, decentralization, APIs, sensors, etc.
- Use Delphi method, scenario planning, or historical analogies.
- Map product against Gartner's Hype Cycle or S-Curve if applicable.

## 6. COMPETITION, INSURGENTS & INCUMBENTS
- List emerging startups and dominant incumbents.
- Analyse their strategies: pricing, partnerships, distribution.
- Assess saturation, whitespace, and window of opportunity.
- Identify strategic gaps: outdated delivery models, misaligned pricing, poor UX.

## 7. RISK & BARRIER ASSESSMENT
- Evaluate risk vectors:
  - Market Risk (PMF, segment mismatch)
  - Technical Risk (feasibility, scalability)
  - Team Risk (execution bandwidth, alignment)
  - Financial Risk (burn rate, unit economics)
- Map structural barriers:
  - Switching costs, regulation, capital requirements, platform dependencies

## 8. TIMING & GO-TO-MARKET SUITABILITY
- Assess market timing: readiness, ripeness, urgency.
- Evaluate timing factors:
  - TRL (Technology Readiness Level)
  - ARL (Adoption Readiness Level)
  - Policy tailwinds, trend resonance, early adoption zones
- Recommend optimal timing window.

## 9. MONETIZATION LOGIC
- Identify viable business models: SaaS, marketplace, transaction fee, licensing.
- Estimate CAC, LTV, margins, pricing logic.
- Simulate unit economics under different adoption scenarios.

## 10. FINAL VERDICT: SHOULD THIS IDEA BE BUILT?
- Synthesize learnings: Is this a venture-scale opportunity?
- Identify blind spots, strategic pivots, or areas for iteration.
- Make recommendation: pursue, refine, pivot, or abandon.

---

# ====== CHAIN-OF-THOUGHT REASONING SPECIFICATION =======
- Use step-by-step reasoning and express intermediate doubts.
- Document hypothesis testing, revision of assumptions.
- Include explicit moments of contradiction or paradox.
- Highlight gaps in information and suggest what else should be validated.
- Do not draw conclusions until a full synthesis has been conducted.

---

# ========= DEEPSEEK INPUT FORMAT (JSON ACCEPTED) =========
User will provide:
- Idea Description
- Proposed Solution
- Intended Users
- Geographic Focus

# ========== OUTPUT FORMAT ==========
Each section must be detailed, referenced, and contain analytical sub-points. Avoid surface-level synthesis. Responses should reflect strategic acuity, systems thinking, and rigorous evaluation.

Your response must be in the following JSON format:
{
"sections": [
  {
    "title": "1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION",
    "content": "Your analysis here..."
  },
  {
    "title": "2. MARKET NEED & DEMAND DYNAMICS",
    "content": "Your analysis here..."
  },
  {
    "title": "3. ALTERNATIVES & CUSTOMER SENTIMENT",
    "content": "Your analysis here..."
  },
  {
    "title": "4. USER BENEFITS & POTENTIAL GAPS",
    "content": "Your analysis here..."
  },
  {
    "title": "5. TRENDS & TECHNOLOGICAL FORCES",
    "content": "Your analysis here..."
  },
  {
    "title": "6. COMPETITION, INSURGENTS & INCUMBENTS",
    "content": "Your analysis here..."
  },
  {
    "title": "7. RISK & BARRIER ASSESSMENT",
    "content": "Your analysis here..."
  },
  {
    "title": "8. TIMING & GO-TO-MARKET SUITABILITY",
    "content": "Your analysis here..."
  },
  {
    "title": "9. MONETIZATION LOGIC",
    "content": "Your analysis here..."
  },
  {
    "title": "10. FINAL VERDICT: SHOULD THIS IDEA BE BUILT?",
    "content": "Your analysis here..."
  }
]
}`

// Function to call DeepSeek API with better error handling
async function callDeepSeekAPI(prompt: string) {
  try {
    // Check if API key is available
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key is not configured")
    }

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 7000,
        response_format: { type: "json_object" },
      }),
    })

    // Get the response as text first
    const responseText = await response.text()

    // If the response is not OK, throw an error with the response text
    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}. Details: ${responseText}`)
    }

    // Try to parse the response as JSON
    try {
      const data = JSON.parse(responseText)
      return data.choices[0].message.content
    } catch (jsonError) {
      console.error("Failed to parse DeepSeek response as JSON:", jsonError)
      console.error("DeepSeek response text:", responseText)
      throw new Error("DeepSeek API returned invalid JSON")
    }
  } catch (error) {
    console.error("Error calling DeepSeek API:", error)
    throw error
  }
}

// Function to call OpenAI API with better error handling
async function callOpenAIAPI(prompt: string, deepseekResponse = "") {
  try {
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured")
    }

    const messages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT,
      },
      {
        role: "user" as const,
        content: prompt,
      },
    ]

    // Only add the DeepSeek response if it exists
    if (deepseekResponse) {
      messages.push({
        role: "assistant" as const,
        content: `Initial analysis from DeepSeek: ${deepseekResponse}`,
      })
      messages.push({
        role: "user" as const,
        content: "Please review, enhance, and finalize this analysis with your own insights and reasoning.",
      })
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    })

    return response.choices[0].message.content
  } catch (error) {
    console.error("Error calling OpenAI API:", error)
    throw error
  }
}

// Function to safely parse JSON
function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch (error) {
    console.error("Failed to parse JSON:", error)
    return null
  }
}

// Function to handle fallback to OpenAI-only analysis
async function fallbackToOpenAI(prompt: string) {
  try {
    console.log("Falling back to OpenAI-only analysis")
    const openaiResponse = await callOpenAIAPI(prompt)

    if (!openaiResponse) {
      throw new Error("Empty response from OpenAI")
    }

    const analysis = safeJsonParse(openaiResponse)

    if (!analysis || !analysis.sections || !Array.isArray(analysis.sections)) {
      throw new Error("Invalid response structure from OpenAI")
    }

    return { analysis }
  } catch (error) {
    console.error("Error in OpenAI fallback:", error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    const { ideaDescription, proposedSolution, intendedUsers, geographicFocus } = body

    // Validate required fields
    if (!ideaDescription) {
      return NextResponse.json({ error: "Problem description is required", analysis: { sections: defaultSections } })
    }

    // Check if API keys are available
    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error("No API keys are configured")
      return NextResponse.json({
        error: "API keys are not configured. Please set at least the OPENAI_API_KEY environment variable.",
        analysis: { sections: defaultSections },
      })
    }

    // If only OpenAI API key is available, use OpenAI-only analysis
    if (!process.env.DEEPSEEK_API_KEY && process.env.OPENAI_API_KEY) {
      console.log("DeepSeek API key not configured, using OpenAI-only analysis")

      // Prepare the prompt with all available information
      const prompt = `
Problem Description: ${ideaDescription}
${proposedSolution ? `Proposed Solution: ${proposedSolution}` : ""}
${intendedUsers ? `Intended Users: ${intendedUsers}` : ""}
${geographicFocus ? `Geographic Focus: ${geographicFocus}` : ""}
`

      try {
        const result = await fallbackToOpenAI(prompt)
        return NextResponse.json(result)
      } catch (error) {
        console.error("Error in OpenAI-only analysis:", error)
        return NextResponse.json({
          error: "Failed to analyze with OpenAI",
          details: error instanceof Error ? error.message : "Unknown error",
          analysis: { sections: defaultSections },
        })
      }
    }

    // Prepare the prompt with all available information
    const prompt = `
Problem Description: ${ideaDescription}
${proposedSolution ? `Proposed Solution: ${proposedSolution}` : ""}
${intendedUsers ? `Intended Users: ${intendedUsers}` : ""}
${geographicFocus ? `Geographic Focus: ${geographicFocus}` : ""}
`

    try {
      // Step 1: Call DeepSeek API for initial analysis
      let deepseekResponse
      try {
        deepseekResponse = await callDeepSeekAPI(prompt)
      } catch (deepseekError) {
        console.error("DeepSeek API call failed, falling back to OpenAI-only:", deepseekError)
        const result = await fallbackToOpenAI(prompt)
        return NextResponse.json(result)
      }

      // Step 2: Call OpenAI API to enhance and finalize the analysis
      let openaiResponse
      try {
        openaiResponse = await callOpenAIAPI(prompt, deepseekResponse)
      } catch (openaiError) {
        console.error("OpenAI API call failed, using DeepSeek response:", openaiError)

        // Try to parse DeepSeek response
        const deepseekAnalysis = safeJsonParse(deepseekResponse)

        if (deepseekAnalysis && deepseekAnalysis.sections && Array.isArray(deepseekAnalysis.sections)) {
          return NextResponse.json({
            analysis: deepseekAnalysis,
            warning: "OpenAI enhancement failed. Using DeepSeek analysis only.",
          })
        } else {
          // If DeepSeek response is not valid, fall back to OpenAI-only
          const result = await fallbackToOpenAI(prompt)
          return NextResponse.json(result)
        }
      }

      // Parse the JSON response
      let analysis

      // Try to parse OpenAI response
      if (openaiResponse) {
        analysis = safeJsonParse(openaiResponse)
      }

      // If OpenAI parsing failed, try DeepSeek response
      if (!analysis && deepseekResponse) {
        analysis = safeJsonParse(deepseekResponse)
      }

      // If both failed, use default sections
      if (!analysis || !analysis.sections || !Array.isArray(analysis.sections)) {
        console.error("Failed to parse both API responses, using default sections")
        return NextResponse.json({
          analysis: { sections: defaultSections },
          warning: "Failed to parse API responses. Using fallback analysis.",
        })
      }

      // Return the analysis
      return NextResponse.json({ analysis })
    } catch (apiError) {
      console.error("API error:", apiError)

      // Try to fall back to OpenAI-only analysis
      try {
        const result = await fallbackToOpenAI(prompt)
        return NextResponse.json({
          ...result,
          warning: "Hybrid analysis failed. Using OpenAI-only analysis.",
        })
      } catch (fallbackError) {
        console.error("Fallback to OpenAI failed:", fallbackError)

        // Return a fallback analysis with detailed error information
        return NextResponse.json({
          error: apiError instanceof Error ? apiError.message : "Unknown API error",
          fallbackError: fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error",
          analysis: { sections: defaultSections },
          warning: "All analysis methods failed. Using default sections.",
        })
      }
    }
  } catch (error) {
    console.error("Error analyzing business idea:", error)

    // Always return a valid JSON response with detailed error information
    return NextResponse.json({
      error: "Failed to analyze business idea",
      details: error instanceof Error ? error.message : "Unknown error",
      analysis: { sections: defaultSections },
    })
  }
}
