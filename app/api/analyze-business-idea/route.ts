import { NextResponse } from "next/server"
import { OpenAI } from "openai"

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Default sections to use as fallback if OpenAI fails
const defaultSections = [
  {
    title: "PROBLEM DEFINITION & HYPOTHESIS VALIDATION",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "MARKET NEED & DEMAND DYNAMICS",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "CURRENT ALTERNATIVES & CUSTOMER SENTIMENT",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "USER BENEFITS & STRATEGIC GAPS",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "TRENDS & ENABLING TECHNOLOGIES",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "COMPETITIVE LANDSCAPE",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "RISK & BARRIER ASSESSMENT",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "MONETIZATION LOGIC",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "TIMING & MACROECONOMIC FACTORS",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
  {
    title: "RECOMMENDATIONS & OPPORTUNITY SUMMARY",
    content:
      "We couldn't analyze this section due to an error. Please try again with a more detailed description or check your OpenAI API key configuration.",
  },
]

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    const { businessIdea } = body

    // Validate required fields
    if (!businessIdea) {
      return NextResponse.json({ error: "Business idea is required" }, { status: 400 })
    }

    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured")
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable." },
        { status: 500 },
      )
    }

    // Call the OpenAI API with better error handling
    try {
      console.log("Calling OpenAI API with business idea:", businessIdea.substring(0, 100) + "...")

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a sophisticated idea analysis engine specializing in early-stage startup evaluation. Your goal is to transform a user-submitted startup idea into a structured viability report using real-world data, high-quality sources, and rigorous, layered analysis.

You must:
- Classify and validate the core user problem
- Map the market need
- Analyze competitor saturation and strategic whitespace
- Evaluate enabling technologies and macroeconomic fit
- Recommend potential go-to-market strategies and business models

You must never speculate. Instead, use your knowledge to:
- Reference authoritative sources (McKinsey, Statista, Gartner, Crunchbase, Failory, Reddit, LinkedIn)
- Summarize and synthesize insights from startup case studies (Failory, YourStory, StarterStory)
- Reference product reviews from G2, TrustRadius, Reddit, Amazon, Software Advice, etc.
- Assess user sentiment and unmet needs
- Reference Google Trends, social chatter, and analyst reports to identify growth signals and timing
- Reference startup directories (Crunchbase, Tracxn) to find active/failed/VC-backed projects in the same category

---

### CONTEXTUAL PROMPT: WHAT YOU'RE ABOUT TO ANALYZE

INPUTS YOU WILL RECEIVE:
- What idea are you thinking about?
- What solution are you thinking of?
- Who is it for?
- Where is it for?

Your task is to:
1. Use the answers to determine the **type of problem** being solved (Blatant, Latent, Aspirational, Critical)
2. Determine **what kind of founder** is proposing this (expert, opportunist, trend-chaser, pain-solver)
3. Classify the problem using the **Pain Frequency Matrix** (Low Freq x High Pain, High Freq x Low Pain, etc.)
4. Ask yourself the **5 Whys** to unearth root causes and map them to real-world expressions of the problem

---

### OUTPUT: STRUCTURED MARKET & FEASIBILITY ANALYSIS

You must produce a 10-part output with the following headings. Each must include rigorous, source-backed reasoning and any retrieved URLs or citations.

---

#### 1. PROBLEM DEFINITION & HYPOTHESIS VALIDATION  
- Classify the problem  
- Use the 5 Whys  
- Reference user behavior, social pain signals  
- Use data from forums and product reviews to validate the urgency  

---

#### 2. MARKET NEED & DEMAND DYNAMICS  
- Use Statista, Reddit, and search volume to gauge demand  
- Use market research to quantify urgency (growth rates, unmet demand)  
- Include ARL assessment (Adoption Readiness Level)  

---

#### 3. CURRENT ALTERNATIVES & CUSTOMER SENTIMENT  
- Identify direct competitors, substitutes, and "status quo" solutions  
- Use Trustpilot, G2, Reddit, Google Reviews to mine user frustrations and satisfactions  
- Use sentiment analysis to rate how receptive users are to change  

---

#### 4. USER BENEFITS & STRATEGIC GAPS  
- Outline functional, social, emotional, and economic value  
- Identify underserved niches  
- Apply Blue Ocean logic — how could this idea differentiate on value curve or delivery method?  

---

#### 5. TRENDS & ENABLING TECHNOLOGIES  
- Check Google Trends, CB Insights, Gartner Hype Cycle  
- Identify timing signals in tech maturity  
- Include whether it's riding macro trends (e.g. remote work, AI adoption, ESG compliance)

---

#### 6. COMPETITIVE LANDSCAPE  
- Who are the insurgents and incumbents?  
- Use Crunchbase or Tracxn to see who's raised funding in the space  
- Extract go-to-market and pricing models from known competitors  

---

#### 7. RISK & BARRIER ASSESSMENT  
- Market risk (PMF uncertainty)  
- Technical risk (can it be built at scale?)  
- Financial risk (burn rate, CAC/LTV)  
- Switching friction and regulatory considerations  
- Team competency (expertise required?)  

---

#### 8. MONETIZATION LOGIC  
- Transaction-based, freemium, SaaS, marketplace, usage-based, affiliate  
- Include potential CAC and LTV frameworks  
- Include the best business model given behavioral friction  

---

#### 9. TIMING & MACROECONOMIC FACTORS  
- Is now the right time?  
- Are there regulatory tailwinds or headwinds?  
- What will shift adoption curves?  
- Use ARL and TRL frameworks to assess both technical and market maturity  

---

#### 10. RECOMMENDATIONS & OPPORTUNITY SUMMARY  
- Is this worth building?  
- What angle would increase odds of success?  
- Suggest specific pivots, go-to-market ideas, or niche customer segments  
- Highlight potential testable MVPs

---

IMPORTANT:
- You must include external validation in every section  
- Avoid fluff. No generic advice. Back every claim with sourced evidence or relevant precedent  
- If a claim is speculative, say so. Your job is not to sell the idea — it's to interrogate it

You must apply the following principles at all times:

• **Depth Over Brevity**: All sections must exceed 1500 characters and offer in-depth, multi-layered insight. Avoid shallow summaries.

• **Chain-of-Thought Reasoning**: Work step-by-step through the logic in plain language, using natural internal monologue and structured headings.

• **Step-Back Prompting**: Begin each section with general reflection and relevant frameworks, then narrow to the case-specific analysis.

• **Source Evaluation**: Use only reputable, up-to-date sources. Prioritize academic, government, or verified commercial data (e.g., McKinsey, BCG, Crunchbase, G2, Gartner, etc.)

• **Critical Evaluation**: At every turn, ask: What assumptions am I making? What might be missing or misleading? What must be true for this to succeed?

Do not write like a chatbot. Write like a senior analyst preparing a due diligence report for an investment committee.

FORMATTING INSTRUCTIONS:
- Use plain text only. DO NOT use markdown formatting.
- DO NOT use stars (*), hashtags (#), or other special characters for formatting.
- Use simple paragraph breaks for readability.
- For lists, use simple dashes (-) or numbers (1., 2., etc.) followed by a space.
- Keep sentences and paragraphs concise and readable.

Your response must be in the following JSON format:
{
"sections": [
  {
    "title": "PROBLEM DEFINITION & HYPOTHESIS VALIDATION",
    "content": "Your analysis here..."
  },
  {
    "title": "MARKET NEED & DEMAND DYNAMICS",
    "content": "Your analysis here..."
  },
  {
    "title": "CURRENT ALTERNATIVES & CUSTOMER SENTIMENT",
    "content": "Your analysis here..."
  },
  {
    "title": "USER BENEFITS & STRATEGIC GAPS",
    "content": "Your analysis here..."
  },
  {
    "title": "TRENDS & ENABLING TECHNOLOGIES",
    "content": "Your analysis here..."
  },
  {
    "title": "COMPETITIVE LANDSCAPE",
    "content": "Your analysis here..."
  },
  {
    "title": "RISK & BARRIER ASSESSMENT",
    "content": "Your analysis here..."
  },
  {
    "title": "MONETIZATION LOGIC",
    "content": "Your analysis here..."
  },
  {
    "title": "TIMING & MACROECONOMIC FACTORS",
    "content": "Your analysis here..."
  },
  {
    "title": "RECOMMENDATIONS & OPPORTUNITY SUMMARY",
    "content": "Your analysis here..."
  }
]
}`,
          },
          {
            role: "user",
            content: businessIdea,
          },
        ],
        temperature: 0.2,
        top_p: 0.95,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      })

      console.log("OpenAI API response received")

      // Extract the generated analysis
      const analysisText = response.choices[0].message.content

      // Parse the JSON response
      let analysis
      try {
        if (!analysisText) {
          throw new Error("Empty response from OpenAI")
        }

        console.log("Parsing JSON response:", analysisText.substring(0, 100) + "...")
        analysis = JSON.parse(analysisText)

        // Validate the structure
        if (!analysis.sections || !Array.isArray(analysis.sections)) {
          throw new Error("Invalid response structure from OpenAI")
        }

        console.log("Successfully parsed JSON response with", analysis.sections.length, "sections")
      } catch (error) {
        console.error("Error parsing JSON response:", error, "Response:", analysisText)

        // Return a fallback analysis instead of an error
        return NextResponse.json({
          analysis: { sections: defaultSections },
          warning: "Failed to parse OpenAI response. Using fallback analysis.",
        })
      }

      // Return the analysis
      return NextResponse.json({ analysis })
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError)

      // Return a fallback analysis instead of an error
      return NextResponse.json({
        analysis: { sections: defaultSections },
        warning: "Error calling OpenAI API. Using fallback analysis.",
        error: openaiError instanceof Error ? openaiError.message : "Unknown OpenAI error",
      })
    }
  } catch (error) {
    console.error("Error analyzing business idea:", error)

    // Always return a valid JSON response, even in case of errors
    return NextResponse.json({
      error: "Failed to analyze business idea",
      details: error instanceof Error ? error.message : "Unknown error",
      analysis: { sections: defaultSections },
    })
  }
}
