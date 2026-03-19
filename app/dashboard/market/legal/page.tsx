"use client"

import { Scale } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function LegalPage() {
  return (
    <AIToolPage
      title="Startup Legal Requirements"
      description="Navigate legal requirements with an AI-generated compliance checklist"
      toolId="legal-requirements"
      icon={<Scale className="h-6 w-6" />}
      fields={[
        {
          key: "Business",
          label: "Business Description",
          placeholder: "Describe your product/service",
          type: "textarea",
          required: true,
        },
        {
          key: "Industry",
          label: "Industry",
          placeholder: "e.g., Healthcare, Fintech, E-commerce",
          type: "input",
          required: true,
        },
        {
          key: "Location",
          label: "Operating Location",
          placeholder: "e.g., United States, EU",
          type: "input",
        },
        {
          key: "Data",
          label: "Do you handle user data?",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "yes-pii", label: "Yes, personal/sensitive data" },
            { value: "yes-basic", label: "Yes, basic user data" },
            { value: "no", label: "No user data" },
          ],
        },
        {
          key: "Employees",
          label: "Team Type",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "founders-only", label: "Founders only" },
            { value: "contractors", label: "Contractors" },
            { value: "employees", label: "Full-time employees" },
            { value: "mixed", label: "Mixed" },
          ],
        },
      ]}
    />
  )
}
