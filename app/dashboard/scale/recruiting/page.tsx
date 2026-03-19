"use client"

import { Users } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function RecruitingPage() {
  return (
    <AIToolPage
      title="Recruiting Agent"
      description="Build your hiring plan, job descriptions, and interview processes"
      toolId="recruiting"
      icon={<Users className="h-6 w-6" />}
      fields={[
        {
          key: "Business",
          label: "Business Description",
          placeholder: "What does your startup do?",
          type: "textarea",
          required: true,
        },
        {
          key: "Current Team",
          label: "Current Team",
          placeholder: "e.g., 2 technical founders, 1 designer",
          type: "input",
        },
        {
          key: "Hiring Needs",
          label: "Roles You Need",
          placeholder: "e.g., Senior backend engineer, growth marketer",
          type: "textarea",
          required: true,
        },
        {
          key: "Budget",
          label: "Hiring Budget",
          placeholder: "e.g., $150K total comp per role",
          type: "input",
        },
        {
          key: "Stage",
          label: "Company Stage",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "pre-seed", label: "Pre-Seed" },
            { value: "seed", label: "Seed" },
            { value: "series-a", label: "Series A" },
            { value: "series-b", label: "Series B+" },
          ],
        },
      ]}
    />
  )
}
