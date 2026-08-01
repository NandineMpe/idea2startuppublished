import { Gauge } from "lucide-react"
import type { UsageSummary } from "@/lib/creator/ai/usage-summary"

/**
 * What the desk has cost.
 *
 * Input and output are shown separately and never summed, because they are
 * priced differently enough that a combined figure cannot be turned into money.
 * These agents are also lopsided in opposite directions — synthesis sends a
 * hundred documents and writes eight short dossiers, a strategy pass is the
 * reverse — so one number would misdescribe both.
 *
 * No prices here. Rates change, they differ per account, and a stale multiplier
 * baked into a screen is worse than an honest token count someone can multiply
 * themselves.
 */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function UsagePanel({ summary }: { summary: UsageSummary }) {
  const { totals, rows, days } = summary

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-1">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground">Model usage</h2>
        <span className="text-[11px] text-muted-foreground">last {days} days</span>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed max-w-[640px]">
        Every agent runs on <span className="font-medium text-foreground/80">claude-opus-5</span>.
        Input and output are counted separately because they are priced differently; multiply by
        your current rates for a figure. Cached input is billed at a fraction of fresh input.
      </p>

      {!totals.calls ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5">
          <p className="text-[12px] text-muted-foreground">
            No agent runs recorded yet in this window. Usage is logged from the moment a pass runs.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[520px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2">Agent</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Runs</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Input</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Cached in</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Output</th>
                  <th className="text-right font-medium px-4 py-2 tabular-nums">Failed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.agent} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 text-foreground">{r.agent}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.calls}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {compact(r.input_tokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.cache_read_tokens ? compact(r.cache_read_tokens) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {compact(r.output_tokens)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {r.failures || "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-medium">
                  <td className="px-4 py-2 text-foreground">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.calls}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{compact(totals.input)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totals.cacheRead ? compact(totals.cacheRead) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{compact(totals.output)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{totals.failures || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
        Search costs are separate and not counted here: the Researcher runs roughly 200 Exa queries
        a day across the sweep, the opportunity hunt and the thread checks. Every other source is
        keyless.
      </p>
    </section>
  )
}
