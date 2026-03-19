"use client"

import { Settings } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function FundingStrategyOptimizerPage() {
  return (
    <AIToolPage
      title="Funding Strategy Optimizer"
      description="Find the optimal fundraising approach for your startup's stage and goals"
      toolId="funding-strategy"
      icon={<Settings className="h-5 w-5 text-primary" />}
      fields={[
        {
          key: "Business",
          label: "Business Description",
          placeholder: "What does your startup do?",
          type: "textarea",
          required: true,
        },
        {
          key: "Stage",
          label: "Current Stage",
          placeholder: "Select",
          type: "select",
          required: true,
          options: [
            { value: "pre-seed", label: "Pre-Seed" },
            { value: "seed", label: "Seed" },
            { value: "series-a", label: "Series A" },
            { value: "series-b", label: "Series B+" },
          ],
        },
        {
          key: "Amount",
          label: "Target Raise",
          placeholder: "e.g., $500K, $2M",
          type: "input",
        },
        {
          key: "Traction",
          label: "Current Traction",
          placeholder: "Revenue, users, key metrics",
          type: "textarea",
        },
        {
          key: "Location",
          label: "Location",
          placeholder: "e.g., San Francisco, London",
          type: "input",
        },
      ]}
    />
  )
}
