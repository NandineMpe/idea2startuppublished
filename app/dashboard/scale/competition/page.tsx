"use client"

import { Target } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function CompetitionPage() {
  return (
    <AIToolPage
      title="Advanced Competition Analyzer"
      description="Deep competitive intelligence with SWOT analysis, positioning maps, and strategic recommendations"
      toolId="competition-advanced"
      icon={<Target className="h-5 w-5 text-primary" />}
      backHref="/dashboard"
      fields={[
        {
          key: "Business",
          label: "Your Business/Product",
          placeholder: "Describe your product or service",
          type: "textarea",
          required: true,
        },
        {
          key: "Industry",
          label: "Industry",
          placeholder: "e.g., Project management SaaS",
          type: "input",
          required: true,
        },
        {
          key: "Known Competitors",
          label: "Known Competitors",
          placeholder: "e.g., Asana, Monday, ClickUp",
          type: "input",
          required: false,
        },
        {
          key: "Your Differentiator",
          label: "Your Unique Edge",
          placeholder: "What makes you different?",
          type: "textarea",
          required: false,
        },
      ]}
    />
  )
}
