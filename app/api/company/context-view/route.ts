import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import {
  type ContextData,
  calcCompleteness,
  parseJackJillJobs,
  parseStringArray,
} from "@/lib/context-view"
import { normalizeVaultFolders } from "@/lib/vault-context-shared"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function formatRelativeFromIso(iso: string | null | undefined): string {
  if (!iso) return "—"
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return "—"
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const workspace =
      url.searchParams.get("scope") === "owner" ? null : await resolveWorkspaceSelection(user.id)

    const [{ data: profile }, { data: onboardingRows }, { data: assets }, { data: competitorRows }] =
      workspace
        ? await Promise.all([
            supabaseAdmin
              .from("client_workspace_profiles")
              .select("*")
              .eq("owner_user_id", user.id)
              .eq("workspace_id", workspace.id)
              .maybeSingle(),
            Promise.resolve({
              data: workspace.lastContextSubmittedAt
                ? [{ created_at: workspace.lastContextSubmittedAt, inputs: null }]
                : [],
            }),
            supabaseAdmin
              .from("client_workspace_assets")
              .select("type, title")
              .eq("owner_user_id", user.id)
              .eq("workspace_id", workspace.id),
            Promise.resolve({ data: [] }),
          ])
        : await Promise.all([
            supabase
              .from("company_profile")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase
              .from("ai_outputs")
              .select("inputs, created_at")
              .eq("user_id", user.id)
              .eq("tool", "onboarding_extraction")
              .order("created_at", { ascending: false })
              .limit(1),
            supabase.from("company_assets").select("type, title").eq("user_id", user.id),
            supabase
              .from("competitor_tracking")
              .select("competitor_name, event_type, title, threat_level, discovered_at")
              .eq("user_id", user.id)
              .order("discovered_at", { ascending: false })
              .limit(80),
          ])

    const rawInputs = onboardingRows?.[0]?.inputs
    const inputsObj = asRecord(rawInputs)
    const extraction = inputsObj.extracted ?? rawInputs
    const ext = asRecord(extraction)
    const strategyExt = asRecord(ext.strategy)

    const prioritiesFromProfile = parseStringArray(profile?.priorities)
    const risksFromProfile = parseStringArray(profile?.risks)
    const prioritiesFromOnboarding = parseStringArray(strategyExt.priorities_90d)
    const risksFromOnboarding = parseStringArray(strategyExt.risks)

    const priorities =
      prioritiesFromProfile.length > 0 ? prioritiesFromProfile : prioritiesFromOnboarding
    const risks = risksFromProfile.length > 0 ? risksFromProfile : risksFromOnboarding

    const p = profile as Record<string, unknown> | null | undefined

    const companyDescription =
      (typeof p?.company_description === "string" && p.company_description) ||
      (typeof p?.tagline === "string" && p.tagline) ||
      ""

    const data: ContextData = {
      knowledge: {
        markdown: (typeof p?.knowledge_base_md === "string" && p.knowledge_base_md) || "",
        updatedAt:
          (typeof p?.knowledge_base_updated_at === "string" && p.knowledge_base_updated_at) || null,
      },
      vault: {
        repo: (typeof p?.github_vault_repo === "string" && p.github_vault_repo) || "",
        branch: (typeof p?.github_vault_branch === "string" && p.github_vault_branch) || "main",
        folders: normalizeVaultFolders(p?.vault_folders),
        connected: Boolean(typeof p?.github_vault_repo === "string" && p.github_vault_repo.trim()),
        lastSyncedAt:
          (typeof p?.vault_context_last_synced_at === "string" && p.vault_context_last_synced_at) || null,
        fileCount:
          typeof p?.vault_context_file_count === "number"
            ? p.vault_context_file_count
            : Number(p?.vault_context_file_count ?? 0) || 0,
        syncError:
          (typeof p?.vault_context_sync_error === "string" && p.vault_context_sync_error) || null,
      },
      company: {
        name:
          (typeof p?.company_name === "string" && p.company_name) || workspace?.companyName || "",
        description: companyDescription,
        problem: (typeof p?.problem === "string" && p.problem) || "",
        solution: (typeof p?.solution === "string" && p.solution) || "",
        market: (typeof p?.target_market === "string" && p.target_market) || "",
        vertical:
          (typeof p?.vertical === "string" && p.vertical) ||
          (typeof p?.industry === "string" && p.industry) ||
          "",
        stage: (typeof p?.stage === "string" && p.stage) || "",
        business_model: (typeof p?.business_model === "string" && p.business_model) || "",
        traction: (typeof p?.traction === "string" && p.traction) || "",
      },
      founder: {
        name: (typeof p?.founder_name === "string" && p.founder_name) || "",
        background: (typeof p?.founder_background === "string" && p.founder_background) || "",
      },
      strategy: {
        thesis: (typeof p?.thesis === "string" && p.thesis) || "",
        icp: parseStringArray(p?.icp),
        competitors: parseStringArray(p?.competitors),
        differentiators: (typeof p?.differentiators === "string" && p.differentiators) || "",
        priorities,
        risks,
        keywords: parseStringArray(p?.keywords),
        jack_jill_jobs: parseJackJillJobs(p?.jack_jill_jobs),
      },
      meta: {
        lastUpdated: formatRelativeFromIso(
          typeof p?.updated_at === "string" ? p.updated_at : undefined,
        ),
        onboardingDate: onboardingRows?.[0]?.created_at
          ? new Date(onboardingRows[0].created_at as string).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "—",
        completeness: 0,
        sources: [],
      },
    }

    data.meta.completeness = calcCompleteness(data)

    const sources = new Set<string>()
    for (const a of assets ?? []) {
      const t = a.type as string
      const title = (a.title as string) || ""
      if (t === "scraped_url") sources.add("website scrape")
      else if (t === "pitch_deck") sources.add("pitch deck")
      else if (t === "document") {
        if (title.includes("Shared intake submission")) sources.add("shared intake")
        else if (title.includes("Onboarding conversation")) sources.add("onboarding conversation")
        else sources.add("documents")
      }
    }
    if (data.knowledge.markdown.trim()) sources.add("knowledge base")
    if (data.vault.connected && data.vault.lastSyncedAt) sources.add("vault cache")
    if (!workspace && onboardingRows?.length) sources.add("onboarding extraction")
    data.meta.sources = Array.from(sources)
    if (data.meta.sources.length === 0) data.meta.sources = ["—"]

    data.competitor_tracking = (competitorRows ?? []).map((r) => ({
      competitor_name: String(r.competitor_name ?? ""),
      event_type: String(r.event_type ?? ""),
      title: String(r.title ?? ""),
      threat_level: r.threat_level != null ? String(r.threat_level) : null,
      discovered_at: String(r.discovered_at ?? ""),
    }))

    return NextResponse.json({
      data,
      scope: workspace ? "workspace" : "owner",
      workspace: workspace ?? null,
    })
  } catch (e) {
    console.error("context-view GET:", e)
    return NextResponse.json({ data: null, error: "Failed to load" }, { status: 500 })
  }
}
