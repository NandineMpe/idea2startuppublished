import { redirect } from "next/navigation"

export default function KnowledgeBasePage() {
  redirect("/dashboard/context?tab=knowledge")
}
