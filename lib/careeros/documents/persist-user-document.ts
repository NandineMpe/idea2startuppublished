import { supabaseAdmin } from "@/lib/supabase"
import { sha256Hex } from "@/lib/careeros/hash"

export type CareerOSDocType = "resume" | "linkedin" | "llm_markdown"

async function nextDocumentVersion(userId: string, docType: CareerOSDocType): Promise<number> {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("user_documents")
    .select("version")
    .eq("user_id", userId)
    .eq("doc_type", docType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return ((data?.version as number | undefined) ?? 0) + 1
}

async function findDocumentByHash(
  userId: string,
  docType: CareerOSDocType,
  textHash: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("user_documents")
    .select("id")
    .eq("user_id", userId)
    .eq("doc_type", docType)
    .eq("text_hash", textHash)
    .maybeSingle()

  if (error) throw error
  return (data?.id as string | undefined) ?? null
}

async function uploadStorageObject(params: {
  storagePath: string
  buffer: Buffer
  contentType: string
}): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from("careeros-documents")
    .upload(params.storagePath, params.buffer, {
      contentType: params.contentType,
      upsert: false,
    })

  if (error) throw error
}

async function insertExtraction(params: {
  userId: string
  userDocumentId: string
  plainText: string
  parserName: string
  parserVersion: string
  inputDataVersion: string
}): Promise<void> {
  const { error } = await supabaseAdmin
    .schema("careeros")
    .from("user_document_extractions")
    .insert({
      user_id: params.userId,
      user_document_id: params.userDocumentId,
      parser_name: params.parserName,
      parser_version: params.parserVersion,
      extraction_version: 1,
      is_current: true,
      parsed_payload: { plain_text: params.plainText },
      input_data_version: params.inputDataVersion,
      source_attribution: { parser: params.parserName },
    })

  if (error) throw error
}

export type PersistTextDocumentParams = {
  userId: string
  docType: CareerOSDocType
  plainText: string
  /** MIME / parser hint */
  contentType: string
  parserName: string
  parserVersion: string
  fileExtension: string
}

/**
 * Stores UTF-8 text as an object in Supabase Storage and registers `user_documents` + extraction rows.
 */
export async function persistTextDocument(
  params: PersistTextDocumentParams,
): Promise<{ documentId: string; textHash: string; deduped: boolean }> {
  const buffer = Buffer.from(params.plainText, "utf8")
  const textHash = sha256Hex(buffer)

  const existingId = await findDocumentByHash(params.userId, params.docType, textHash)
  if (existingId) {
    return { documentId: existingId, textHash, deduped: true }
  }

  const version = await nextDocumentVersion(params.userId, params.docType)
  const storagePath = `${params.userId}/${params.docType}/v${version}-${textHash.slice(0, 10)}.${params.fileExtension.replace(/^\./, "")}`

  await uploadStorageObject({
    storagePath,
    buffer,
    contentType: params.contentType,
  })

  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("user_documents")
    .insert({
      user_id: params.userId,
      doc_type: params.docType,
      version,
      storage_bucket: "careeros-documents",
      storage_path: storagePath,
      text_hash: textHash,
      content_mime_type: params.contentType,
      content_bytes: buffer.byteLength,
    })
    .select("id")
    .single()

  if (error) throw error

  const documentId = data.id as string
  await insertExtraction({
    userId: params.userId,
    userDocumentId: documentId,
    plainText: params.plainText,
    parserName: params.parserName,
    parserVersion: params.parserVersion,
    inputDataVersion: textHash,
  })

  return { documentId, textHash, deduped: false }
}

export async function extractPdfPlainText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")) as unknown as (
    input: Buffer,
  ) => Promise<{ text?: string }>
  const data = await pdfParse(buffer)
  return data.text || ""
}

export type PersistPdfResumeParams = {
  userId: string
  buffer: Buffer
  filename: string
}

export async function persistPdfResume(
  params: PersistPdfResumeParams,
): Promise<{ documentId: string; textHash: string; plainText: string; deduped: boolean }> {
  const plainText = await extractPdfPlainText(params.buffer)
  const textHash = sha256Hex(params.buffer)

  const existingId = await findDocumentByHash(params.userId, "resume", textHash)
  if (existingId) {
    return { documentId: existingId, textHash, plainText, deduped: true }
  }

  const version = await nextDocumentVersion(params.userId, "resume")
  const storagePath = `${params.userId}/resume/v${version}-${textHash.slice(0, 10)}-${sanitizeFilename(params.filename)}`

  await uploadStorageObject({
    storagePath,
    buffer: params.buffer,
    contentType: "application/pdf",
  })

  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("user_documents")
    .insert({
      user_id: params.userId,
      doc_type: "resume",
      version,
      storage_bucket: "careeros-documents",
      storage_path: storagePath,
      text_hash: textHash,
      content_mime_type: "application/pdf",
      content_bytes: params.buffer.byteLength,
    })
    .select("id")
    .single()

  if (error) throw error

  const documentId = data.id as string
  await insertExtraction({
    userId: params.userId,
    userDocumentId: documentId,
    plainText,
    parserName: "pdf-parse",
    parserVersion: "lib",
    inputDataVersion: textHash,
  })

  return { documentId, textHash, plainText, deduped: false }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "resume.pdf"
}
