"use client"

import { Database } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function StartupCreditsDatabasePage() {
  return (
    <AIToolPage
      title="Startup Credits Database"
      description="Find free credits, perks, and programs available for startups"
      toolId="startup-credits"
      icon={<Database className="h-5 w-5 text-primary" />}
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
          label: "Stage",
          placeholder: "Select",
          type: "select",
          required: true,
          options: [
            { value: "idea", label: "Idea" },
            { value: "mvp", label: "MVP" },
            { value: "launched", label: "Launched" },
            { value: "funded", label: "Funded" },
          ],
        },
        {
          key: "Needs",
          label: "What do you need?",
          placeholder: "e.g., Cloud hosting, email tools, payment processing",
          type: "textarea",
        },
        {
          key: "Location",
          label: "Location",
          placeholder: "e.g., United States",
          type: "input",
        },
      ]}
    />
  )
}
