"use client"

import { Globe } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function InternationalisationStrategyPage() {
  return (
    <AIToolPage
      title="Internationalisation Strategy"
      description="Plan your expansion into global markets with AI-powered market analysis"
      toolId="internationalisation"
      icon={<Globe className="h-5 w-5 text-primary" />}
      backHref="/dashboard"
      fields={[
        {
          key: "Business",
          label: "Your Business",
          placeholder: "Describe your product/service and current market",
          type: "textarea",
          required: true,
        },
        {
          key: "Current Markets",
          label: "Current Markets",
          placeholder: "e.g., United States",
          type: "input",
          required: true,
        },
        {
          key: "Target Markets",
          label: "Target Expansion Markets",
          placeholder: "e.g., UK, Germany, Japan",
          type: "input",
        },
        {
          key: "Revenue",
          label: "Current Annual Revenue",
          placeholder: "e.g., $500K ARR",
          type: "input",
        },
        {
          key: "Challenges",
          label: "Known Challenges",
          placeholder: "e.g., Language barriers, regulatory concerns",
          type: "textarea",
          required: false,
        },
      ]}
    />
  )
}
