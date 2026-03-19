"use client"

import { Target } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function FundingReadinessScorePage() {
  return (
    <AIToolPage
      title="Funding Readiness Score"
      description="Assess how ready your startup is for fundraising across key dimensions"
      toolId="funding-readiness"
      icon={<Target className="h-5 w-5 text-primary" />}
      fields={[
        {
          key: "Business",
          label: "Business Description",
          placeholder: "What does your startup do?",
          type: "textarea",
          required: true,
        },
        {
          key: "Team",
          label: "Team Background",
          placeholder: "Founders' experience, team size, key hires",
          type: "textarea",
        },
        {
          key: "Traction",
          label: "Current Traction",
          placeholder: "Users, revenue, growth rate, partnerships",
          type: "textarea",
        },
        {
          key: "Stage",
          label: "Current Stage",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "idea", label: "Idea" },
            { value: "prototype", label: "Prototype" },
            { value: "mvp", label: "MVP" },
            { value: "revenue", label: "Revenue" },
            { value: "growth", label: "Growth" },
          ],
        },
      ]}
    />
  )
}
