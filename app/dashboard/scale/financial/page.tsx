"use client"

import { LineChart } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function FinancialEngineeringPage() {
  return (
    <AIToolPage
      title="Financial Engineering"
      description="Build financial projections, unit economics, and scenario analysis"
      toolId="financial-engineering"
      icon={<LineChart className="h-5 w-5 text-primary" />}
      fields={[
        {
          key: "Business",
          label: "Business Description",
          placeholder: "Describe your business model",
          type: "textarea",
          required: true,
        },
        {
          key: "Revenue Model",
          label: "Revenue Model",
          placeholder: "e.g., SaaS subscription, marketplace commission",
          type: "input",
          required: true,
        },
        {
          key: "Current Revenue",
          label: "Current Monthly Revenue",
          placeholder: "e.g., $5,000/mo or Pre-revenue",
          type: "input",
        },
        {
          key: "Stage",
          label: "Stage",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "pre-revenue", label: "Pre-Revenue" },
            { value: "early", label: "Early Revenue (<$10K/mo)" },
            { value: "growing", label: "Growing ($10K-$100K/mo)" },
            { value: "scaling", label: "Scaling ($100K+/mo)" },
          ],
        },
        {
          key: "Team Size",
          label: "Team Size",
          placeholder: "e.g., 3 founders, 2 engineers",
          type: "input",
        },
      ]}
    />
  )
}
