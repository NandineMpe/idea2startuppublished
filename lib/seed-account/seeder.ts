/**
 * Seeder — orchestrates the full seed pipeline for one founder:
 *
 *   1. Create a Supabase auth user (unconfirmed, no password yet)
 *   2. Ensure their personal organization exists
 *   3. Upsert company_profile with the synthesized data
 *   4. Write vault_context_cache with the knowledge_base_md
 *      (so every agent sees rich context immediately)
 *   5. Pre-run 3 ai_outputs: market brief, competitor snapshot, content draft
 *   6. Store claim token in seeded_invites
 *   7. Return everything needed for the email send
 */

import crypto from "crypto"
import { supabaseAdmin } from "@/lib/supabase"
import { ensurePersonalOrganization } from "@/lib/organizations"
import { generateText } from "ai"
import { qwenModel } from "@/lib/llm-provider"
import type { ResearchInput } from "./researcher"
import type { SynthesisResult } from "./synthesizer"

export interface SeedResult {
  userId: string
  organizationId: string
  organizationSlug: string
  organizationName: string
  claimToken: string
  seededInviteId: string
}

interface SeedTenantOptions {
  organizationSlug?: string
  organizationName?: string
  companyDomain?: string
}

// ─── claim token ──────────────────────────────────────────────────────────────

function generateClaimToken(): string {
  return crypto.randomBytes(32).toString("base64url")
}

// ─── pre-run ai_outputs ───────────────────────────────────────────────────────

async function preRunOutputs(
  userId: string,
  organizationId: string,
  profile: SynthesisResult["profile"],
  knowledgeBase: string,
): Promise<void> {
  const contextBlock = `
Company: ${profile.company_name}
${profile.tagline ? `Tagline: ${profile.tagline}` : ""}
${profile.company_description}

Problem: ${profile.problem}
Solution: ${profile.solution}
ICP: ${profile.icp.join(", ")}
Competitors: ${profile.competitors.join(", ")}
Stage: ${profile.stage}
Vertical: ${profile.vertical || profile.industry}
Business model: ${profile.business_model}
Founder: ${profile.founder_name} — ${profile.founder_background}

${knowledgeBase}
`.trim()

  const outputs: Array<{ tool: string; title: string; prompt: string }> = [
    {
      tool: "daily_brief",
      title: `Morning Market Brief — ${profile.company_name}`,
      prompt: `You are Juno, an AI agent for ${profile.company_name}.
Write a sharp morning market brief for ${profile.founder_name}.
Cover: (1) one key market trend affecting their space, (2) one signal from their ICP segment, (3) one competitor move worth watching.
Keep it under 250 words. Be specific — name companies, numbers, and dates where available.
Context:\n${contextBlock}`,
    },
    {
      tool: "competitor-snapshot",
      title: "Competitor Snapshot",
      prompt: `You are Juno, an AI agent for ${profile.company_name}.
Write a competitor snapshot covering: ${profile.competitors.slice(0, 4).join(", ")}.
For each: positioning, recent moves, and where ${profile.company_name} has an edge.
Keep it under 300 words. Be direct.
Context:\n${contextBlock}`,
    },
    {
      tool: "content_linkedin",
      title: `3 LinkedIn Drafts — ${profile.company_name}`,
      prompt: `You are Juno, an AI agent for ${profile.company_name}.
Write 3 short LinkedIn posts for ${profile.founder_name}.
Each post should feel like it comes from a founder who thinks publicly about the problem they are solving.
Use the brand voice: ${profile.brand_voice_dna || "direct, founder-led, no jargon"}.
Separate each post with ---
Context:\n${contextBlock}`,
    },
  ]

  await Promise.all(
    outputs.map(async ({ tool, title, prompt }) => {
      try {
        const { text } = await generateText({
          model: qwenModel(),
          maxTokens: 800,
          prompt,
        })
        await supabaseAdmin.from("ai_outputs").insert({
          user_id: userId,
          tool,
          title,
          inputs: {
            seeded: true,
            company: profile.company_name,
            organization_id: organizationId,
          },
          output: text.trim(),
        })
      } catch (err) {
        // non-fatal — dashboard still loads, just one panel is empty
        console.error(`[seeder] pre-run ${tool} failed:`, err)
      }
    }),
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────

export async function seedFounderAccount(
  input: ResearchInput,
  synthesis: SynthesisResult,
  seededByUserId: string,
  tenantOptions: SeedTenantOptions = {},
): Promise<SeedResult> {
  const { profile, emailPreview } = synthesis

  // 1. Create unconfirmed auth user
  // Supabase admin createUser does NOT send a confirmation email —
  // the founder only gains access when they claim via our token.
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: input.targetEmail,
    email_confirm: false, // stays unconfirmed until claim
    user_metadata: {
      full_name: profile.founder_name || input.founderName,
      seeded: true,
    },
  })

  if (authErr || !authData?.user) {
    throw new Error(`Failed to create auth user: ${authErr?.message}`)
  }

  const userId = authData.user.id

  // 2. Ensure a personal tenant for this founder and brand it to their startup.
  const orgDisplayName = tenantOptions.organizationName?.trim() || profile.company_name || input.companyName
  const org = await ensurePersonalOrganization(userId, {
    displayName: orgDisplayName,
    requestedSlug: tenantOptions.organizationSlug,
  })

  // 3. Upsert company_profile
  const profileRow = {
    user_id: userId,
    organization_id: org.id,
    company_name: profile.company_name,
    tagline: profile.tagline,
    company_description: profile.company_description,
    problem: profile.problem,
    solution: profile.solution,
    target_market: profile.target_market,
    industry: profile.industry,
    vertical: profile.vertical,
    stage: profile.stage,
    business_model: profile.business_model,
    traction: profile.traction,
    thesis: profile.thesis,
    differentiators: profile.differentiators,
    icp: JSON.stringify(profile.icp),
    competitors: JSON.stringify(profile.competitors),
    keywords: JSON.stringify(profile.keywords),
    priorities: JSON.stringify(profile.priorities),
    risks: JSON.stringify(profile.risks),
    founder_name: profile.founder_name,
    founder_background: profile.founder_background,
    founder_location: profile.founder_location,
    brand_voice_dna: profile.brand_voice_dna,
    brand_promise: profile.brand_promise,
    brand_words_use: JSON.stringify(profile.brand_words_use),
    brand_words_never: JSON.stringify(profile.brand_words_never),
    // 4. Write knowledge_base_md AND vault_context_cache — agents read both
    knowledge_base_md: profile.knowledge_base_md,
    vault_context_cache: profile.knowledge_base_md,
    vault_context_last_synced_at: new Date().toISOString(),
    vault_context_file_count: 12, // signals richness in the UI
  }

  let profileErr: { message: string } | null = null
  {
    const { error } = await supabaseAdmin
      .from("company_profile")
      .upsert(profileRow, { onConflict: "organization_id" })
    profileErr = error ? { message: error.message } : null
  }

  // Backward-compatible fallback for environments that still enforce legacy unique(user_id).
  if (profileErr && /no unique|on conflict/i.test(profileErr.message)) {
    const { error: legacyError } = await supabaseAdmin
      .from("company_profile")
      .upsert(profileRow, { onConflict: "user_id" })
    profileErr = legacyError ? { message: legacyError.message } : null
  }

  if (profileErr) {
    console.error("[seeder] company_profile upsert failed:", profileErr.message)
    throw new Error(`Failed to save company profile: ${profileErr.message}`)
  }

  // 5. Pre-run ai_outputs
  await preRunOutputs(userId, org.id, profile, profile.knowledge_base_md)

  // 6. Generate claim token + store in seeded_invites
  const claimToken = generateClaimToken()

  const invitePayload = {
    user_id: userId,
    target_email: input.targetEmail,
    target_name: profile.founder_name || input.founderName,
    target_company: profile.company_name,
    target_url: input.companyUrl,
    target_linkedin: input.linkedinUrl ?? null,
    organization_id: org.id,
    token: claimToken,
    seeded_by: seededByUserId,
    email_preview: emailPreview,
    seed_data: {
      profile,
      company_domain: tenantOptions.companyDomain ?? null,
      organization_slug: org.slug,
      research_sources: Object.keys(synthesis),
    },
  }

  let invite: { id: string } | null = null
  let inviteErr: { message: string } | null = null
  {
    const { data, error } = await supabaseAdmin
      .from("seeded_invites")
      .insert(invitePayload)
      .select("id")
      .single()
    invite = data
    inviteErr = error ? { message: error.message } : null
  }

  // Backward-compatible fallback for environments that have not applied the new column yet.
  if (inviteErr && /organization_id/i.test(inviteErr.message)) {
    const { organization_id: _orgId, ...legacyPayload } = invitePayload
    const { data, error } = await supabaseAdmin
      .from("seeded_invites")
      .insert(legacyPayload)
      .select("id")
      .single()
    invite = data
    inviteErr = error ? { message: error.message } : null
  }

  if (inviteErr || !invite) {
    throw new Error(`Failed to create seeded_invite: ${inviteErr?.message}`)
  }

  return {
    userId,
    organizationId: org.id,
    organizationSlug: org.slug,
    organizationName: org.displayName,
    claimToken,
    seededInviteId: invite.id,
  }
}
