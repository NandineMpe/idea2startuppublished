import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { parseStringArray } from "@/lib/context-view"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0
}

export type BrainLedgerData = {
  profile: {
    company_name: string
    tagline: string
    company_description: string
    problem: string
    solution: string
    target_market: string
    vertical: string
    industry: string
    stage: string
    business_model: string
    traction: string
    thesis: string
    differentiators: string
    icp: string[]
    competitors: string[]
    keywords: string[]
    priorities: string[]
    risks: string[]
    founder_name: string
    founder_location: string
    founder_background: string
    brand_voice_dna: string
    brand_promise: string
    brand_words_use: string[]
    brand_words_never: string[]
    brand_credibility_hooks: string[]
    updated_at: string | null
  }
  knowledge: {
    markdown: string
    updated_at: string | null
    word_count: number
  }
  vault: {
    repo: string
    branch: string
    connected: boolean
    last_synced_at: string | null
    file_count: number
    sync_error: string | null
  }
  assets: Array<{
    id: string
    type: string
    title: string
    source_url: string | null
    created_at: string
  }>
  ai_outputs: Array<{
    id: string
    tool: string
    title: string
    output_preview: string
    created_at: string
  }>
  competitor_events: Array<{
    id: string
    competitor_name: string
    event_type: string
    title: string
    description: string
    threat_level: string | null
    why_it_matters: string
    suggested_response: string
    funding_amount: string
    funding_round: string
    discovered_at: string
  }>
  funding_events: Array<{
    id: string
    company_name: string
    round_type: string
    amount: string
    lead_investor: string
    relevance: string
    signal: string
    is_competitor: boolean
    announced_date: string | null
    discovered_at: string
  }>
  intent_signals: Array<{
    id: string
    platform: string
    signal_type: string
    title: string
    why_relevant: string
    urgency: string | null
    matched_keywords: string[]
    status: string
    discovered_at: string
  }>
  outreach: Array<{
    id: string
    to_name: string
    to_company: string
    to_title: string
    subject: string
    status: string
    outcome: string | null
    sent_at: string | null
    created_at: string
  }>
  daily_briefs: Array<{
    id: string
    brief_date: string
    raw_item_count: number
    scored_item_count: number
    created_at: string
  }>
  chat_sessions: Array<{
    id: string
    title: string
    channel: string
    message_count: number
    created_at: string
    updated_at: string
  }>
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const uid = user.id
    const workspace = await resolveWorkspaceSelection(uid)

    if (workspace) {
      const [{ data: profile }, { data: assets }] = await Promise.all([
        supabaseAdmin
          .from("client_workspace_profiles")
          .select("*")
          .eq("owner_user_id", uid)
          .eq("workspace_id", workspace.id)
          .maybeSingle(),
        supabaseAdmin
          .from("client_workspace_assets")
          .select("id, type, title, source_url, created_at")
          .eq("owner_user_id", uid)
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false }),
      ])

      const p = (profile ?? {}) as Record<string, unknown>
      const knowledgeMd = str(p.knowledge_base_md)
      const wordCount = knowledgeMd.trim() ? (knowledgeMd.trim().match(/\S+/g)?.length ?? 0) : 0

      const ledger: BrainLedgerData = {
        profile: {
          company_name: str(p.company_name) || (workspace.companyName ?? ""),
          tagline: str(p.tagline),
          company_description: str(p.company_description),
          problem: str(p.problem),
          solution: str(p.solution),
          target_market: str(p.target_market),
          vertical: str(p.vertical) || str(p.industry),
          industry: str(p.industry),
          stage: str(p.stage),
          business_model: str(p.business_model),
          traction: str(p.traction),
          thesis: str(p.thesis),
          differentiators: str(p.differentiators),
          icp: parseStringArray(p.icp),
          competitors: parseStringArray(p.competitors),
          keywords: parseStringArray(p.keywords),
          priorities: parseStringArray(p.priorities),
          risks: parseStringArray(p.risks),
          founder_name: str(p.founder_name),
          founder_location: str(p.founder_location),
          founder_background: str(p.founder_background),
          brand_voice_dna: str(p.brand_voice_dna),
          brand_promise: str(p.brand_promise),
          brand_words_use: parseStringArray(p.brand_words_use),
          brand_words_never: parseStringArray(p.brand_words_never),
          brand_credibility_hooks: parseStringArray(p.brand_credibility_hooks),
          updated_at: typeof p.updated_at === "string" ? p.updated_at : workspace.updatedAt,
        },
        knowledge: {
          markdown: knowledgeMd,
          updated_at:
            typeof p.knowledge_base_updated_at === "string"
              ? p.knowledge_base_updated_at
              : workspace.lastContextSubmittedAt,
          word_count: wordCount,
        },
        vault: {
          repo: str(p.github_vault_repo),
          branch: str(p.github_vault_branch) || "main",
          connected: Boolean(str(p.github_vault_repo).trim()),
          last_synced_at:
            typeof p.vault_context_last_synced_at === "string" ? p.vault_context_last_synced_at : null,
          file_count: num(p.vault_context_file_count),
          sync_error: typeof p.vault_context_sync_error === "string" ? p.vault_context_sync_error : null,
        },
        assets: (assets ?? []).map((a) => ({
          id: str(a.id),
          type: str(a.type),
          title: str(a.title),
          source_url: typeof a.source_url === "string" ? a.source_url : null,
          created_at: str(a.created_at),
        })),
        ai_outputs: [],
        competitor_events: [],
        funding_events: [],
        intent_signals: [],
        outreach: [],
        daily_briefs: [],
        chat_sessions: [],
      }

      return NextResponse.json({ data: ledger, scope: "workspace", workspace })
    }

    const [
      profileRes,
      assetsRes,
      aiOutputsRes,
      competitorRes,
      fundingRes,
      intentRes,
      outreachRes,
      briefsRes,
      sessionsRes,
      msgCountsRes,
    ] = await Promise.all([
      supabase.from("company_profile").select("*").eq("user_id", uid).maybeSingle(),
      supabase
        .from("company_assets")
        .select("id, type, title, source_url, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("ai_outputs")
        .select("id, tool, title, output, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("competitor_tracking")
        .select("id, competitor_name, event_type, title, description, threat_level, why_it_matters, suggested_response, funding_amount, funding_round, discovered_at")
        .eq("user_id", uid)
        .order("discovered_at", { ascending: false })
        .limit(100),
      supabase
        .from("funding_tracker")
        .select("id, company_name, round_type, amount, lead_investor, relevance, signal, is_competitor, announced_date, discovered_at")
        .eq("user_id", uid)
        .order("discovered_at", { ascending: false })
        .limit(50),
      supabase
        .from("intent_signals")
        .select("id, platform, signal_type, title, why_relevant, urgency, matched_keywords, status, discovered_at")
        .eq("user_id", uid)
        .order("discovered_at", { ascending: false })
        .limit(50),
      supabase
        .from("outreach_log")
        .select("id, to_name, to_company, to_title, subject, status, outcome, sent_at, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("daily_briefs")
        .select("id, brief_date, raw_item_count, scored_item_count, created_at")
        .eq("user_id", uid)
        .order("brief_date", { ascending: false })
        .limit(30),
      supabase
        .from("chat_sessions")
        .select("id, title, channel, created_at, updated_at")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase
        .from("chat_messages")
        .select("session_id")
        .eq("user_id", uid),
    ])

    // Count messages per session
    const msgCountMap: Record<string, number> = {}
    for (const msg of msgCountsRes.data ?? []) {
      const sid = String(msg.session_id)
      msgCountMap[sid] = (msgCountMap[sid] ?? 0) + 1
    }

    const p = (profileRes.data ?? {}) as Record<string, unknown>
    const knowledgeMd = str(p.knowledge_base_md)
    const wordCount = knowledgeMd.trim() ? (knowledgeMd.trim().match(/\S+/g)?.length ?? 0) : 0

    const ledger: BrainLedgerData = {
      profile: {
        company_name: str(p.company_name),
        tagline: str(p.tagline),
        company_description: str(p.company_description),
        problem: str(p.problem),
        solution: str(p.solution),
        target_market: str(p.target_market),
        vertical: str(p.vertical) || str(p.industry),
        industry: str(p.industry),
        stage: str(p.stage),
        business_model: str(p.business_model),
        traction: str(p.traction),
        thesis: str(p.thesis),
        differentiators: str(p.differentiators),
        icp: parseStringArray(p.icp),
        competitors: parseStringArray(p.competitors),
        keywords: parseStringArray(p.keywords),
        priorities: parseStringArray(p.priorities),
        risks: parseStringArray(p.risks),
        founder_name: str(p.founder_name),
        founder_location: str(p.founder_location),
        founder_background: str(p.founder_background),
        brand_voice_dna: str(p.brand_voice_dna),
        brand_promise: str(p.brand_promise),
        brand_words_use: parseStringArray(p.brand_words_use),
        brand_words_never: parseStringArray(p.brand_words_never),
        brand_credibility_hooks: parseStringArray(p.brand_credibility_hooks),
        updated_at: typeof p.updated_at === "string" ? p.updated_at : null,
      },
      knowledge: {
        markdown: knowledgeMd,
        updated_at: typeof p.knowledge_base_updated_at === "string" ? p.knowledge_base_updated_at : null,
        word_count: wordCount,
      },
      vault: {
        repo: str(p.github_vault_repo),
        branch: str(p.github_vault_branch) || "main",
        connected: Boolean(str(p.github_vault_repo).trim()),
        last_synced_at: typeof p.vault_context_last_synced_at === "string" ? p.vault_context_last_synced_at : null,
        file_count: num(p.vault_context_file_count),
        sync_error: typeof p.vault_context_sync_error === "string" ? p.vault_context_sync_error : null,
      },
      assets: (assetsRes.data ?? []).map((a) => ({
        id: str(a.id),
        type: str(a.type),
        title: str(a.title),
        source_url: typeof a.source_url === "string" ? a.source_url : null,
        created_at: str(a.created_at),
      })),
      ai_outputs: (aiOutputsRes.data ?? []).map((o) => ({
        id: str(o.id),
        tool: str(o.tool),
        title: str(o.title),
        output_preview: str(o.output).slice(0, 300),
        created_at: str(o.created_at),
      })),
      competitor_events: (competitorRes.data ?? []).map((c) => ({
        id: str(c.id),
        competitor_name: str(c.competitor_name),
        event_type: str(c.event_type),
        title: str(c.title),
        description: str(c.description),
        threat_level: c.threat_level != null ? str(c.threat_level) : null,
        why_it_matters: str(c.why_it_matters),
        suggested_response: str(c.suggested_response),
        funding_amount: str(c.funding_amount),
        funding_round: str(c.funding_round),
        discovered_at: str(c.discovered_at),
      })),
      funding_events: (fundingRes.data ?? []).map((f) => ({
        id: str(f.id),
        company_name: str(f.company_name),
        round_type: str(f.round_type),
        amount: str(f.amount),
        lead_investor: str(f.lead_investor),
        relevance: str(f.relevance),
        signal: str(f.signal),
        is_competitor: Boolean(f.is_competitor),
        announced_date: typeof f.announced_date === "string" ? f.announced_date : null,
        discovered_at: str(f.discovered_at),
      })),
      intent_signals: (intentRes.data ?? []).map((s) => ({
        id: str(s.id),
        platform: str(s.platform),
        signal_type: str(s.signal_type),
        title: str(s.title),
        why_relevant: str(s.why_relevant),
        urgency: s.urgency != null ? str(s.urgency) : null,
        matched_keywords: Array.isArray(s.matched_keywords)
          ? (s.matched_keywords as string[]).map(str)
          : [],
        status: str(s.status),
        discovered_at: str(s.discovered_at),
      })),
      outreach: (outreachRes.data ?? []).map((o) => ({
        id: str(o.id),
        to_name: str(o.to_name),
        to_company: str(o.to_company),
        to_title: str(o.to_title),
        subject: str(o.subject),
        status: str(o.status),
        outcome: o.outcome != null ? str(o.outcome) : null,
        sent_at: typeof o.sent_at === "string" ? o.sent_at : null,
        created_at: str(o.created_at),
      })),
      daily_briefs: (briefsRes.data ?? []).map((b) => ({
        id: str(b.id),
        brief_date: str(b.brief_date),
        raw_item_count: num(b.raw_item_count),
        scored_item_count: num(b.scored_item_count),
        created_at: str(b.created_at),
      })),
      chat_sessions: (sessionsRes.data ?? []).map((s) => ({
        id: str(s.id),
        title: str(s.title),
        channel: str(s.channel),
        message_count: msgCountMap[str(s.id)] ?? 0,
        created_at: str(s.created_at),
        updated_at: str(s.updated_at),
      })),
    }

    return NextResponse.json({ data: ledger })
  } catch (e) {
    console.error("brain-ledger GET:", e)
    return NextResponse.json({ error: "Failed to load brain ledger" }, { status: 500 })
  }
}
