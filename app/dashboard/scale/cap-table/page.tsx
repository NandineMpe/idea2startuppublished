"use client"

import { PieChart } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function CapTableManagementPage() {
  return (
    <AIToolPage
      title="Cap Table Management"
      description="Model your equity structure, option pool, and dilution across funding rounds"
      toolId="cap-table"
      icon={<PieChart className="h-5 w-5 text-primary" />}
      fields={[
        {
          key: "Founders",
          label: "Founders & Equity Split",
          placeholder: "e.g., Alice 50%, Bob 30%, Charlie 20%",
          type: "textarea",
          required: true,
        },
        {
          key: "Stage",
          label: "Current Stage",
          placeholder: "Select",
          type: "select",
          options: [
            { value: "pre-seed", label: "Pre-Seed" },
            { value: "seed", label: "Seed" },
            { value: "series-a", label: "Series A" },
          ],
        },
        {
          key: "Valuation",
          label: "Current/Expected Valuation",
          placeholder: "e.g., $5M pre-money",
          type: "input",
        },
        {
          key: "ESOP",
          label: "Employee Option Pool",
          placeholder: "e.g., 10% reserved",
          type: "input",
        },
        {
          key: "Investors",
          label: "Current/Planned Investors",
          placeholder: "e.g., Angel invested $200K at $2M valuation",
          type: "textarea",
          required: false,
        },
      ]}
    />
  )
}
