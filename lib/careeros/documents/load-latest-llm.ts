import { supabaseAdmin } from "@/lib/supabase"

/** Plain text from the latest `llm_markdown` extraction for this user. */
export async function loadLatestLlmMarkdownPlainText(
  userId: string,
): Promise<string | null> {
  const { data: doc, error: docError } = await supabaseAdmin
    .schema("careeros")
    .from("user_documents")
    .select("id")
    .eq("user_id", userId)
    .eq("doc_type", "llm_markdown")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (docError) throw docError
  const docId = doc?.id as string | undefined
  if (!docId) return null

  const { data: ex, error: exError } = await supabaseAdmin
    .schema("careeros")
    .from("user_document_extractions")
    .select("parsed_payload")
    .eq("user_document_id", docId)
    .eq("is_current", true)
    .maybeSingle()

  if (exError) throw exError

  const payload = ex?.parsed_payload as { plain_text?: string } | null | undefined
  const text = payload?.plain_text?.trim()
  return text && text.length > 0 ? text : null
}
