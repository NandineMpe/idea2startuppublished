import Link from "next/link"
import { KnowledgePageContent } from "@/components/dashboard/knowledge-page-content"

export default function KnowledgeBasePage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Knowledge</p>
        <h1 className="text-2xl font-semibold text-foreground">Knowledge base</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Documents, vault captures, and your Obsidian vault connection. Your structured company brain lives
          under{" "}
          <Link href="/dashboard/context" className="text-primary hover:underline">
            Context
          </Link>
          .
        </p>
      </div>
      <KnowledgePageContent />
    </div>
  )
}
