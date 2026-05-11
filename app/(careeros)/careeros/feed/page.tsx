import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FeedItemActions } from "@/components/careeros/feed-item-actions"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function entityColor(t: string) {
  if (t === "model_release") return "text-blue-700"
  if (t === "research_finding") return "text-amber-700"
  if (t === "product_launch") return "text-emerald-700"
  return "text-muted-foreground"
}

export default async function CareerOSFeedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rows } = await supabase
    .schema("careeros")
    .from("user_ai_feed_items")
    .select("id,feed_type,feed_at,title,item_payload,personalised_note,source_attribution,dismissed_at")
    .eq("user_id", user.id)
    .is("dismissed_at", null)
    .gte("feed_at", cutoff)
    .order("feed_at", { ascending: false })
    .limit(20)

  const weeklyCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const newThisWeek = (rows ?? []).filter((r) => String(r.feed_at) >= weeklyCutoff).length

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your AI Updates</h1>
          <p className="text-sm text-muted-foreground">{newThisWeek} new this week</p>
        </div>
        <Link href="/careeros/market" className="text-sm text-primary hover:underline">
          Back to Market Briefing
        </Link>
      </div>

      {!rows?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>We&apos;re building your feed</CardTitle>
            <CardDescription>
              Your feed updates daily. Check back in 24 hours for personalised AI updates.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        rows.map((item) => {
          const payload =
            item.item_payload && typeof item.item_payload === "object"
              ? (item.item_payload as Record<string, unknown>)
              : {}
          const sourceAttr =
            item.source_attribution && typeof item.source_attribution === "object"
              ? (item.source_attribution as Record<string, unknown>)
              : {}
          const feedType = String(item.feed_type)
          const isCareerHealth = feedType === "career_health_report"
          const sourceUrl = String(payload.source_url ?? sourceAttr.source_url ?? "#")
          const summary = String(payload.summary ?? "")
          const reportHref =
            typeof payload.href === "string" && payload.href.startsWith("/")
              ? payload.href
              : "/careeros/health-report"
          return (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardDescription className={entityColor(feedType)}>
                  {feedType} · {new Date(String(item.feed_at)).toLocaleDateString()}
                </CardDescription>
                <CardTitle className="text-lg">{String(item.title)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{summary}</p>
                <div>
                  <p className="font-medium">What this means for you</p>
                  <p className="text-muted-foreground">{String(item.personalised_note ?? "No personalised note yet.")}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Source: {String(sourceAttr.source_key ?? payload.source_key ?? "unknown")} ·{" "}
                  {new Date(String(item.feed_at)).toISOString().slice(0, 10)}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <FeedItemActions itemId={String(item.id)} />
                  {isCareerHealth ? (
                    <Link href={reportHref} className="text-primary hover:underline">
                      Open report
                    </Link>
                  ) : (
                    <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Open original →
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </main>
  )
}
