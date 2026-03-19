"use client"

import { FileText } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function BusinessPlanPage() {
  return (
    <AIToolPage
      title="Full Business Plan"
      description="Generate a comprehensive business plan ready for investors and stakeholders"
      toolId="business-plan"
      icon={<FileText className="h-6 w-6" />}
      fields={[
        {
          key: "Business",
          label: "Business Description",
          placeholder: "Describe your business idea in detail",
          type: "textarea",
          required: true,
        },
        {
          key: "Target Market",
          label: "Target Market",
          placeholder: "Who are your customers?",
          type: "textarea",
          required: true,
        },
        {
          key: "Revenue Model",
          label: "Revenue Model",
          placeholder: "How will you make money?",
          type: "input",
        },
        {
          key: "Stage",
          label: "Current Stage",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "idea", label: "Idea" },
            { value: "mvp", label: "MVP" },
            { value: "launched", label: "Launched" },
            { value: "growth", label: "Growth" },
          ],
        },
        {
          key: "Funding",
          label: "Funding Status",
          placeholder: "e.g., Bootstrapped, $100K angel round",
          type: "input",
        },
        {
          key: "Team",
          label: "Team",
          placeholder: "Describe your team and key skills",
          type: "textarea",
        },
      ]}
    />
  )
}
