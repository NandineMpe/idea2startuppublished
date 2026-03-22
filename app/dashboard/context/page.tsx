"use client"

import { Suspense } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Layers } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { CompanyPageContent } from "@/components/dashboard/company-page-content"
import { KnowledgePageContent } from "@/components/dashboard/knowledge-page-content"

function ContextTabs() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") === "knowledge" ? "knowledge" : "company"

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="h-9">
        <TabsTrigger value="company" className="text-[13px]">Company &amp; Founder</TabsTrigger>
        <TabsTrigger value="knowledge" className="text-[13px]">Knowledge Base</TabsTrigger>
      </TabsList>

      <TabsContent value="company" className="mt-6">
        <CompanyPageContent />
      </TabsContent>

      <TabsContent value="knowledge" className="mt-6">
        <KnowledgePageContent />
      </TabsContent>
    </Tabs>
  )
}

export default function ContextPage() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agent briefing room</p>
        <div className="flex items-center gap-2.5">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">My Context</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Everything your agents know about you. The richer this context, the more relevant every output becomes.
        </p>
      </div>

      <Suspense fallback={<div className="text-[13px] text-muted-foreground">Loading...</div>}>
        <ContextTabs />
      </Suspense>
    </div>
  )
}
