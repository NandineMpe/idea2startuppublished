import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * What the agents have cost, by pass.
 *
 * Aggregated in code rather than SQL: PostgREST cannot express a grouped sum
 * without a view or an RPC, and at these volumes — single figures of calls a
 * day — pulling the rows is cheaper than maintaining either.
 */

export type UsageRow = {
  agent: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  failures: number
}

export type UsageSummary = {
  rows: UsageRow[]
  totals: { calls: number; input: number; output: number; cacheRead: number; failures: number }
  days: number
}

export async function loadUsageSummary(
  supabase: SupabaseClient,
  userId: string,
  days = 30,
): Promise<UsageSummary> {
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data } = await supabase
    .schema("creator")
    .from("creator_usage")
    .select("agent,model,input_tokens,output_tokens,cache_read_tokens,ok")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(5000)

  const byAgent = new Map<string, UsageRow>()
  const totals = { calls: 0, input: 0, output: 0, cacheRead: 0, failures: 0 }

  for (const r of data ?? []) {
    const row = byAgent.get(r.agent as string) ?? {
      agent: r.agent as string,
      model: r.model as string,
      calls: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      failures: 0,
    }
    row.calls++
    row.input_tokens += (r.input_tokens as number) ?? 0
    row.output_tokens += (r.output_tokens as number) ?? 0
    row.cache_read_tokens += (r.cache_read_tokens as number) ?? 0
    if (!r.ok) row.failures++
    byAgent.set(r.agent as string, row)

    totals.calls++
    totals.input += (r.input_tokens as number) ?? 0
    totals.output += (r.output_tokens as number) ?? 0
    totals.cacheRead += (r.cache_read_tokens as number) ?? 0
    if (!r.ok) totals.failures++
  }

  return {
    rows: [...byAgent.values()].sort(
      (a, b) => b.output_tokens - a.output_tokens || b.input_tokens - a.input_tokens,
    ),
    totals,
    days,
  }
}
