"use client"

import { Calendar } from "lucide-react"
import { AIToolPage } from "@/components/dashboard/ai-tool-page"

export default function GlobalStartupEventsPage() {
  return (
    <AIToolPage
      title="Global Startup Events"
      description="Find relevant conferences, accelerators, and networking opportunities worldwide"
      toolId="global-events"
      icon={<Calendar className="h-5 w-5 text-primary" />}
      backHref="/dashboard"
      fields={[
        {
          key: "Industry",
          label: "Your Industry",
          placeholder: "e.g., AI/ML, Climate Tech, SaaS",
          type: "input",
          required: true,
        },
        {
          key: "Stage",
          label: "Startup Stage",
          placeholder: "Select stage",
          type: "select",
          required: true,
          options: [
            { value: "idea", label: "Idea Stage" },
            { value: "pre-seed", label: "Pre-Seed" },
            { value: "seed", label: "Seed" },
            { value: "series-a", label: "Series A+" },
            { value: "growth", label: "Growth" },
          ],
        },
        {
          key: "Location",
          label: "Preferred Location",
          placeholder: "e.g., North America, Europe, Asia, Remote",
          type: "input",
        },
        {
          key: "Goals",
          label: "What are you looking for?",
          placeholder: "e.g., Finding investors, meeting co-founders, learning about AI",
          type: "textarea",
        },
      ]}
    />
  )
}
