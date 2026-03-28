import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveGithubRepoFromProfile } from "@/lib/juno/security-scan-profile"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get("status") || "open"

  let q = supabase.from("security_findings").select("*").eq("user_id", user.id)
  if (statusFilter !== "all") {
    q = q.eq("status", statusFilter)
  }
  const { data: findings, error: fErr } = await q.order("created_at", { ascending: false })

  if (fErr) {
    console.error("[api/security GET]", fErr.message)
    return NextResponse.json({ error: "Failed to load findings" }, { status: 500 })
  }

  const { data: profile } = await supabase
    .from("company_profile")
    .select("github_repo, github_branch, github_vault_owner, github_vault_repo, github_vault_branch")
    .eq("user_id", user.id)
    .maybeSingle()

  const resolved = profile
    ? resolveGithubRepoFromProfile({
        github_repo: profile.github_repo as string | null,
        github_branch: profile.github_branch as string | null,
        github_vault_owner: profile.github_vault_owner as string | null,
        github_vault_repo: profile.github_vault_repo as string | null,
        github_vault_branch: profile.github_vault_branch as string | null,
      })
    : null

  const { data: lastScan } = await supabase
    .from("security_scans")
    .select("created_at, status, new_findings, resolved_count, files_scanned, total_findings, error_message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
  for (const row of findings ?? []) {
    const s = String(row.severity || "").toLowerCase()
    if (s === "critical") counts.critical++
    else if (s === "high") counts.high++
    else if (s === "medium") counts.medium++
    else if (s === "low") counts.low++
    counts.total++
  }

  return NextResponse.json({
    findings: findings ?? [],
    counts,
    repo: resolved?.repo ?? null,
    branch: resolved?.branch ?? null,
    lastScan: lastScan ?? null,
  })
}
