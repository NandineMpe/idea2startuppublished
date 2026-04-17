import { redirect } from "next/navigation"
import Link from "next/link"
import { Lock } from "lucide-react"
import { getIntelligencePreviewShareBySlug } from "@/lib/intelligence-preview"

export const dynamic = "force-dynamic"

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "This preview link is invalid or has been deactivated.",
  user_missing: "The account behind this preview is no longer available.",
  link_failed: "Could not start the preview session. Try again in a moment.",
  verify_failed: "Could not start the preview session. Try again in a moment.",
}

export default async function PreviewLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { slug } = await params
  const { error } = await searchParams

  if (!error) {
    const share = await getIntelligencePreviewShareBySlug(slug)
    if (!share) {
      redirect(`/preview/intelligence/${encodeURIComponent(slug)}?error=not_found`)
    }
    redirect(`/api/preview/intelligence/${encodeURIComponent(slug)}/enter`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <Lock className="h-10 w-10 text-white/30 mx-auto mb-4" />
        <p className="text-white/80 text-base font-medium mb-2">Preview unavailable</p>
        <p className="text-white/50 text-sm mb-6">
          {ERROR_MESSAGES[error] ?? "Something went wrong opening the preview."}
        </p>
        <Link
          href={`/preview/intelligence/${encodeURIComponent(slug)}`}
          className="inline-flex items-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  )
}
