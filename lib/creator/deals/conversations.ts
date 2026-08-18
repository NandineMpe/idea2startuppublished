import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "../query"

/**
 * Brand conversations: the record a follow-up is written against.
 *
 * Everything here is loaded and written server-side. A follow-up is drafted days
 * after the reply, so nothing in this flow can rely on state the browser was
 * holding at the time.
 */

export type ConversationMessageKind = "reply" | "follow_up" | "breakup"

export type ConversationMessage = {
  seq: number
  kind: ConversationMessageKind
  body: string
  drafted_at: string
  sent_at: string | null
}

export type ConversationState = "open" | "replied" | "won" | "lost"

export type CreatorConversation = {
  id: string
  brand: string | null
  inbound: string
  what_they_want: string | null
  deliverables: string[]
  quoted_total: number | null
  currency: string | null
  messages: ConversationMessage[]
  state: ConversationState
  sent_at: string | null
  last_contact_at: string | null
  created_at: string
}

const CONVERSATION_COLUMNS =
  // One literal, never concatenated: PostgREST parses this at the type level and
  // a `+` collapses every row to unknown.
  "id,brand,inbound,what_they_want,deliverables,quoted_total,currency,messages,state,sent_at,last_contact_at,created_at"

/** Whole days of silence since the last thing she sent, or null if nothing has been sent. */
export function daysSilent(conversation: CreatorConversation, now = Date.now()): number | null {
  const since = conversation.last_contact_at ?? conversation.sent_at
  if (!since) return null
  return Math.floor((now - new Date(since).getTime()) / 86_400_000)
}

/** How many chasers have already gone out. The reply itself is not a follow-up. */
export function followUpsSent(conversation: CreatorConversation): number {
  return conversation.messages.filter((m) => m.kind !== "reply" && m.sent_at).length
}

/**
 * When a follow-up is due.
 *
 * Three days, then ten, then twenty-one. The gaps widen because a chaser sent
 * two days after the last one reads as pressure, and pressure is what gets an
 * email filed rather than answered.
 */
export const FOLLOW_UP_DUE_DAYS = [3, 10, 21] as const
export const MAX_FOLLOW_UPS = FOLLOW_UP_DUE_DAYS.length

export function followUpDue(conversation: CreatorConversation, now = Date.now()): boolean {
  if (conversation.state !== "open") return false
  const sent = followUpsSent(conversation)
  if (sent >= MAX_FOLLOW_UPS) return false
  const silent = daysSilent(conversation, now)
  if (silent === null) return false
  return silent >= FOLLOW_UP_DUE_DAYS[sent]
}

export async function loadConversations(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorConversation[]> {
  return safeRows<CreatorConversation>(
    supabase
      .schema("creator")
      .from("creator_conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("last_contact_at", { ascending: false, nullsFirst: true })
      .limit(50),
  )
}

export async function loadConversation(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<CreatorConversation | null> {
  const { data, error } = await supabase
    .schema("creator")
    .from("creator_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) return null
  return (data as CreatorConversation | null) ?? null
}

/**
 * Record a drafted reply as the opening message of a conversation.
 *
 * sent_at stays null. She has been handed text to copy, not proof she sent it,
 * and chasing an email that never went out is the worst message a brand can
 * receive. She marks it sent, and only then does the clock start.
 */
export async function openConversation(
  supabase: SupabaseClient,
  userId: string,
  input: {
    brand: string | null
    inbound: string
    what_they_want: string
    deliverables: string[]
    quoted_total: number
    currency: string
    reply: string
  },
): Promise<string | null> {
  const message: ConversationMessage = {
    seq: 1,
    kind: "reply",
    body: input.reply,
    drafted_at: new Date().toISOString(),
    sent_at: null,
  }

  const { data, error } = await supabase
    .schema("creator")
    .from("creator_conversations")
    .insert({
      user_id: userId,
      brand: input.brand,
      inbound: input.inbound,
      what_they_want: input.what_they_want,
      deliverables: input.deliverables,
      quoted_total: input.quoted_total,
      currency: input.currency,
      messages: [message],
    })
    .select("id")
    .maybeSingle()

  if (error) return null
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Append a drafted message.
 *
 * Read-modify-write on the jsonb array. Safe here because a conversation holds
 * at most four messages and one person drafts them one at a time from one
 * screen; it would not be safe if anything ever drafted these in parallel.
 */
export async function appendMessage(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  kind: ConversationMessageKind,
  body: string,
): Promise<ConversationMessage | null> {
  const conversation = await loadConversation(supabase, userId, conversationId)
  if (!conversation) return null

  const message: ConversationMessage = {
    seq: conversation.messages.length + 1,
    kind,
    body,
    drafted_at: new Date().toISOString(),
    sent_at: null,
  }

  const { error } = await supabase
    .schema("creator")
    .from("creator_conversations")
    .update({ messages: [...conversation.messages, message], updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", conversationId)

  return error ? null : message
}

/** Mark a drafted message as actually sent, which is what starts the silence clock. */
export async function markSent(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  seq: number,
): Promise<boolean> {
  const conversation = await loadConversation(supabase, userId, conversationId)
  if (!conversation) return false

  const now = new Date().toISOString()
  const messages = conversation.messages.map((m) => (m.seq === seq ? { ...m, sent_at: m.sent_at ?? now } : m))

  const { error } = await supabase
    .schema("creator")
    .from("creator_conversations")
    .update({
      messages,
      sent_at: conversation.sent_at ?? now,
      last_contact_at: now,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("id", conversationId)

  return !error
}

export async function setConversationState(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  state: ConversationState,
): Promise<boolean> {
  const { error } = await supabase
    .schema("creator")
    .from("creator_conversations")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", conversationId)

  return !error
}
