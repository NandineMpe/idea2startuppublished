export interface MarketSizeData {
  tam: {
    value: string
    customers: string
    description?: string
    method?: string
    source?: string
    confidence?: string
  }
  sam: {
    value: string
    customers: string
    description?: string
    method?: string
    source?: string
    confidence?: string
  }
  som: {
    value: string
    customers: string
    description?: string
    method?: string
    source?: string
    confidence?: string
  }
  tamMethodology?: string
  samMethodology?: string
  somMethodology?: string
}

export interface ConsumerInsightsData {
  marketDefinition: string
  customerSegments: string[]
  painPoints: string
  behavioralPatterns: string
  adoptionTriggers: string
  trends: string
}

export function parseMarketSizeData(content: string): MarketSizeData | null {
  if (!content) return null

  try {
    // Extract TAM, SAM, SOM sections
    const tamSection = content.match(/### TAM.*?(?=###|$)/is)?.[0] || ""
    const samSection = content.match(/### SAM.*?(?=###|$)/is)?.[0] || ""
    const somSection = content.match(/### SOM.*?(?=###|$)/is)?.[0] || ""

    // Extract dollar values with improved regex
    const tamValueMatch =
      tamSection.match(/\$([\d.,]+\s*(?:billion|million|thousand))/i) ||
      tamSection.match(/\$([\d.,]+[BKM])/i) ||
      tamSection.match(/\$([\d.,]+)/i)

    const samValueMatch =
      samSection.match(/\$([\d.,]+\s*(?:billion|million|thousand))/i) ||
      samSection.match(/\$([\d.,]+[BKM])/i) ||
      samSection.match(/\$([\d.,]+)/i)

    const somValueMatch =
      somSection.match(/\$([\d.,]+\s*(?:billion|million|thousand))/i) ||
      somSection.match(/\$([\d.,]+[BKM])/i) ||
      somSection.match(/\$([\d.,]+)/i)

    // Extract customer counts
    const tamCustomersMatch =
      tamSection.match(/(\d+[\d,.]*\s*(?:million|thousand|billion)?\s*customers)/i) ||
      tamSection.match(/(\d+[\d,.]*[KMB]?\s*customers)/i)

    const samCustomersMatch =
      samSection.match(/(\d+[\d,.]*\s*(?:million|thousand|billion)?\s*customers)/i) ||
      samSection.match(/(\d+[\d,.]*[KMB]?\s*customers)/i)

    const somCustomersMatch =
      somSection.match(/(\d+[\d,.]*\s*(?:million|thousand|billion)?\s*customers)/i) ||
      somSection.match(/(\d+[\d,.]*[KMB]?\s*customers)/i)

    // Extract descriptions
    const tamDescMatch = tamSection.match(/TAM.*?[\r\n]+([^$#\r\n][^\r\n]+)/i)
    const samDescMatch = samSection.match(/SAM.*?[\r\n]+([^$#\r\n][^\r\n]+)/i)
    const somDescMatch = somSection.match(/SOM.*?[\r\n]+([^$#\r\n][^\r\n]+)/i)

    // Extract methodologies
    const tamMethodologyMatch = tamSection.match(/method(?:ology)?:?\s*([^.\r\n]+)/i)
    const samMethodologyMatch = samSection.match(/method(?:ology)?:?\s*([^.\r\n]+)/i)
    const somMethodologyMatch = somSection.match(/method(?:ology)?:?\s*([^.\r\n]+)/i)

    // Extract confidence levels
    const tamConfidenceMatch = tamSection.match(/confidence:?\s*(High|Moderate|Low)/i)
    const samConfidenceMatch = samSection.match(/confidence:?\s*(High|Moderate|Low)/i)
    const somConfidenceMatch = somSection.match(/confidence:?\s*(High|Moderate|Low)/i)

    // Extract data sources
    const tamSourceMatch = tamSection.match(/(?:source|data source):?\s*([^.\r\n]+)/i)
    const samSourceMatch = samSection.match(/(?:source|data source):?\s*([^.\r\n]+)/i)
    const somSourceMatch = somSection.match(/(?:source|data source):?\s*([^.\r\n]+)/i)

    return {
      tam: {
        value: tamValueMatch ? `$${tamValueMatch[1]}` : "$100 million",
        customers: tamCustomersMatch ? tamCustomersMatch[1] : "1 million customers",
        description: tamDescMatch ? tamDescMatch[1].trim() : "Global market opportunity",
        method: tamMethodologyMatch ? tamMethodologyMatch[1].trim() : "Top-down industry analysis",
        source: tamSourceMatch ? tamSourceMatch[1].trim() : "Industry reports",
        confidence: tamConfidenceMatch ? tamConfidenceMatch[1] : "Moderate",
      },
      sam: {
        value: samValueMatch ? `$${samValueMatch[1]}` : "$50 million",
        customers: samCustomersMatch ? samCustomersMatch[1] : "500,000 customers",
        description: samDescMatch ? samDescMatch[1].trim() : "Serviceable segment by geography and channel",
        method: samMethodologyMatch ? samMethodologyMatch[1].trim() : "Geographic filtering",
        source: samSourceMatch ? samSourceMatch[1].trim() : "TAM with constraints applied",
        confidence: samConfidenceMatch ? samConfidenceMatch[1] : "Moderate",
      },
      som: {
        value: somValueMatch ? `$${somValueMatch[1]}` : "$10 million",
        customers: somCustomersMatch ? somCustomersMatch[1] : "100,000 customers",
        description: somDescMatch ? somDescMatch[1].trim() : "Realistically obtainable within 18-24 months",
        method: somMethodologyMatch ? somMethodologyMatch[1].trim() : "Competitive benchmark analysis",
        source: somSourceMatch ? somSourceMatch[1].trim() : "Industry penetration rates",
        confidence: somConfidenceMatch ? somConfidenceMatch[1] : "Low",
      },
      tamMethodology: tamSection.split(/\n/).slice(1).join("\n").trim(),
      samMethodology: samSection.split(/\n/).slice(1).join("\n").trim(),
      somMethodology: somSection.split(/\n/).slice(1).join("\n").trim(),
    }
  } catch (error) {
    console.error("Error parsing market size data:", error)
    return null
  }
}

export function parseConsumerInsightsData(content: string): ConsumerInsightsData | null {
  if (!content) return null

  try {
    // Extract market definition with more flexible patterns
    const marketDefinitionMatch =
      content.match(/## Market Definition(?:.*?)(?=\n\s*##|$)/is) ||
      content.match(/## Market Definition & Size([\s\S]*?)(?=###|$)/is) ||
      content.match(/market(?:\s+is)?(?:\s+defined)(?:.*?)(?=\n\s*##|$)/is)

    let marketDefinition = "No market definition available."
    if (marketDefinitionMatch && marketDefinitionMatch[0]) {
      // Strip the heading and extract just the content
      const withoutHeading = marketDefinitionMatch[0].replace(/## Market Definition.*?\n/i, "").trim()
      // Extract text before any subheadings
      marketDefinition = withoutHeading.split(/###/)[0].trim()
    }

    // Extract customer segments with more flexible patterns
    const customerSegmentsMatch =
      content.match(/## Customer Segments([\s\S]*?)(?=##|$)/i) ||
      content.match(/Customer Segments([\s\S]*?)(?=##|$)/i) ||
      content.match(/Target Segments([\s\S]*?)(?=##|$)/i) ||
      content.match(/Behavioral Personas([\s\S]*?)(?=##|$)/i)

    let customerSegments: string[] = []

    if (customerSegmentsMatch) {
      const segmentsText = customerSegmentsMatch[1] || ""
      // Extract bullet points with more flexible pattern
      const bulletPoints = segmentsText.match(/[-*•]\s+([^\n]+)/g) || segmentsText.match(/\d+\.\s+([^\n]+)/g)
      if (bulletPoints) {
        customerSegments = bulletPoints.map((point) => point.replace(/[-*•\d+.]\s+/, "").trim())
      } else {
        // If no bullet points, try to extract paragraphs that might describe segments
        const paragraphs = segmentsText.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
        if (paragraphs.length > 0) {
          customerSegments = paragraphs.map((p) => p.trim()).slice(0, 5) // Limit to 5 segments
        }
      }
    }

    // Extract consumer behavior sections with more flexible patterns
    const painPointsMatch =
      content.match(/Consumer Pain Points([\s\S]*?)(?=##|$)/i) ||
      content.match(/Pain Points([\s\S]*?)(?=##|$)/i) ||
      content.match(/Customer Pain([\s\S]*?)(?=##|$)/i) ||
      content.match(/Friction(?:\s+in\s+current\s+processes)?([\s\S]*?)(?=##|$)/i)

    const behavioralPatternsMatch =
      content.match(/Behavioral Patterns([\s\S]*?)(?=##|$)/i) ||
      content.match(/Consumer Behavior([\s\S]*?)(?=##|$)/i) ||
      content.match(/Current Behaviors([\s\S]*?)(?=##|$)/i) ||
      content.match(/## Consumer Behavior & Demand Signals([\s\S]*?)(?=##|$)/i)

    const adoptionTriggersMatch =
      content.match(/Adoption Triggers([\s\S]*?)(?=##|$)/i) ||
      content.match(/Purchase Triggers([\s\S]*?)(?=##|$)/i) ||
      content.match(/Emotional Triggers([\s\S]*?)(?=##|$)/i) ||
      content.match(/Buying Triggers([\s\S]*?)(?=##|$)/i)

    const trendsMatch =
      content.match(/Trends (?:&|and) Cultural Forces([\s\S]*?)(?=##|$)/i) ||
      content.match(/Market Trends([\s\S]*?)(?=##|$)/i) ||
      content.match(/Cultural Forces([\s\S]*?)(?=##|$)/i) ||
      content.match(/Industry Trends([\s\S]*?)(?=##|$)/i)

    const painPoints = painPointsMatch ? painPointsMatch[1].trim() : "No pain points data available."
    const behavioralPatterns = behavioralPatternsMatch
      ? behavioralPatternsMatch[1].trim()
      : "No behavioral patterns data available."
    const adoptionTriggers = adoptionTriggersMatch
      ? adoptionTriggersMatch[1].trim()
      : "No adoption triggers data available."
    const trends = trendsMatch ? trendsMatch[1].trim() : "No trends data available."

    return {
      marketDefinition,
      customerSegments: customerSegments.length > 0 ? customerSegments : ["No customer segments identified"],
      painPoints,
      behavioralPatterns,
      adoptionTriggers,
      trends,
    }
  } catch (error) {
    console.error("Error parsing consumer insights data:", error)
    return null
  }
}
