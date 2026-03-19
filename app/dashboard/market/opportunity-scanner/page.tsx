"use client"

import { Search } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function OpportunityScannerPage() {
  return (
    <AIToolPage
      title="Business Opportunity Scanner"
      description="Discover emerging market opportunities and untapped potential in your industry"
      toolId="opportunity-scanner"
      icon={<Search className="h-5 w-5 text-primary" />}
      backHref="/dashboard"
      fields={[
        {
          key: "Industry",
          label: "Industry or Domain",
          placeholder: "e.g., Healthcare, Fintech, EdTech",
          type: "input",
          required: true,
        },
        {
          key: "Focus Area",
          label: "Specific Focus Area",
          placeholder: "e.g., AI diagnostics, payment infrastructure",
          type: "input",
          required: false,
        },
        {
          key: "Target Market",
          label: "Target Market",
          placeholder: "e.g., North America, Europe, Global",
          type: "input",
          required: false,
        },
        {
          key: "Stage",
          label: "Your Current Stage",
          placeholder: "Select stage",
          type: "select",
          options: [
            { value: "idea", label: "Idea" },
            { value: "mvp", label: "MVP" },
            { value: "launched", label: "Launched" },
            { value: "growth", label: "Growth" },
          ],
        },
      ]}
    />
  )
}
