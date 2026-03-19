"use client"

import { FileText } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function LLCFormationPage() {
  return (
    <AIToolPage
      title="LLC Formation Service"
      description="Get guidance on setting up your business entity with the right structure"
      toolId="llc-formation"
      icon={<FileText className="h-6 w-6" />}
      fields={[
        {
          key: "Business",
          label: "Business Description",
          placeholder: "What does your startup do?",
          type: "textarea",
          required: true,
        },
        {
          key: "Location",
          label: "Preferred State",
          placeholder: "e.g., Delaware, Wyoming, California",
          type: "input",
        },
        {
          key: "Founders",
          label: "Number of Founders",
          placeholder: "e.g., 2",
          type: "input",
        },
        {
          key: "Fundraising",
          label: "Planning to Raise VC?",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "yes", label: "Yes, planning to raise" },
            { value: "maybe", label: "Maybe later" },
            { value: "no", label: "No, bootstrapping" },
          ],
        },
        {
          key: "Revenue",
          label: "Expected Revenue Model",
          placeholder: "e.g., SaaS, marketplace, services",
          type: "input",
        },
      ]}
    />
  )
}
