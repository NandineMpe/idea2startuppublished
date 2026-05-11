import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { queueCareerHealthReport } from "./actions"

export const dynamic = "force-dynamic"

type Pillar = {
  key: string
  score_0_100: number
  summary: string
}

type Narrative = {
  headline: string
  subhead?: string
  opening: string
  closing: string
  recommended_actions: Array<{
    title: string
    detail: string
    related_pillar: string
    priority: number
  }>
}

type PageProps = {
  searchParams?: Promise<{ status?: string; message?: string }>
}

export default async function CareerHealthReportPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {}
  const status = typeof sp.status === "string" ? sp.status : ""
  const statusMessage = typeof sp.message === "string" ? sp.message : ""

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: row, error } = await supabase
    .schema("careeros")
    .from("user_career_health_reports")
    .select("id,report_year,report_quarter,score_overall,report_payload,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-destructive">Could not load your report ({error.message}).</p>
      </main>
    )
  }

  const payload = row?.report_payload as Record<string, unknown> | null | undefined
  const structured = payload?.structured_inputs as
    | { period_label?: string; pillar_scores?: Pillar[]; composite_score_0_100?: number }
    | undefined
  const narrative = payload?.narrative as Narrative | undefined

  const periodLabel =
    structured?.period_label ??
    (row?.report_year != null && row?.report_quarter != null
      ? `Q${row.report_quarter} ${row.report_year}`
      : "Career Health")
  const composite =
    typeof row?.score_overall === "number"
      ? Number(row.score_overall)
      : typeof structured?.composite_score_0_100 === "number"
        ? structured.composite_score_0_100
        : null

  const pillars = Array.isArray(structured?.pillar_scores)
    ? (structured!.pillar_scores as Pillar[])
    : []

  const statusBanner =
    status === "queued"
      ? "Report queued. Give it a few minutes, then refresh this page."
      : status === "too_soon"
        ? "You already have a fresh report from the last 24 hours."
        : status === "no_inngest"
          ? "Job queue is not configured (INNGEST_EVENT_KEY missing on the server)."
          : status === "error" && statusMessage
            ? statusMessage
            : status === "error"
              ? "Something went wrong."
              : null

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          CareerOS / Career Health Report
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{periodLabel} report</h1>
          <Link href="/careeros" className="text-sm text-primary hover:underline">
            Back to CareerOS
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          One scan across exposure, skills, demand, pay, layoff signals, and velocity. First run about
          seven days after profile extraction, then roughly every ninety days.
        </p>
      </div>

      {statusBanner && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{statusBanner}</p>
      )}

      {!row && (
        <Card>
          <CardHeader>
            <CardTitle>No report yet</CardTitle>
            <CardDescription>
              Your first report is scheduled automatically. You can also queue one now (subject to a
              24-hour cooldown).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={queueCareerHealthReport}>
              <Button type="submit" variant="default" size="sm">
                Queue Career Health Report
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {row && (
        <>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-4xl font-bold tabular-nums">
                {composite != null ? Math.round(composite) : "—"}
                <span className="text-lg font-medium text-muted-foreground"> / 100</span>
              </CardTitle>
              <CardDescription className="text-base text-foreground">
                {narrative?.headline ?? "Career Health composite"}
              </CardDescription>
              {narrative?.subhead && (
                <p className="text-sm text-muted-foreground">{narrative.subhead}</p>
              )}
            </CardHeader>
          </Card>

          <form action={queueCareerHealthReport} className="flex justify-end">
            <Button type="submit" variant="outline" size="sm">
              Queue updated report
            </Button>
          </form>

          {(narrative?.opening || narrative?.closing) && (
            <Card>
              <CardHeader>
                <CardTitle>Briefing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed">
                {narrative?.opening && <p>{narrative.opening}</p>}
                {narrative?.closing && <p>{narrative.closing}</p>}
              </CardContent>
            </Card>
          )}

          {pillars.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
                <CardDescription>
                  Six pillars feed the composite. Numbers are model-guided, not a guarantee.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pillars.map((p) => (
                  <div key={p.key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium capitalize">{p.key.replace(/_/g, " ")}</span>
                      <span className="tabular-nums text-muted-foreground">{Math.round(p.score_0_100)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, p.score_0_100))}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{p.summary}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {narrative?.recommended_actions && narrative.recommended_actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prioritised actions</CardTitle>
                <CardDescription>Pick one this week. Small moves compound.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...narrative.recommended_actions]
                  .sort((a, b) => a.priority - b.priority)
                  .map((a, i) => (
                    <div key={`${a.title}-${i}`} className="rounded-lg border border-border p-4">
                      <p className="text-sm font-semibold">
                        {i + 1}. {a.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{a.detail}</p>
                      <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {a.related_pillar.replace(/_/g, " ")}
                      </p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Generated {row.created_at ? new Date(String(row.created_at)).toLocaleString() : ""}. Method{" "}
            {(payload?.schema as string) ?? "career_health_report_v1"}.
          </p>
        </>
      )}
    </main>
  )
}
