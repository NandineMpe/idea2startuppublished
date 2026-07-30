/**
 * Shell-first tolerance: the `creator` schema does not exist until its migration lands.
 * Loaders run against it anyway and degrade to empty rather than throwing, so every
 * screen renders its real empty state today and starts returning data the moment the
 * migration is applied — with no change to the loaders or the UI.
 *
 * Only missing-relation errors are swallowed. Everything else still throws.
 */

type QueryError = { code?: string | null; message?: string | null } | null

/** Postgres `undefined_table` / insufficient privilege, plus PostgREST's unexposed-schema codes. */
const MISSING_RELATION_CODES = new Set(["42P01", "42501", "PGRST106", "PGRST205"])

export function isMissingRelation(error: QueryError): boolean {
  if (!error) return false
  if (error.code && MISSING_RELATION_CODES.has(error.code)) return true
  const message = error.message?.toLowerCase() ?? ""
  return message.includes("does not exist") || message.includes("schema must be one of")
}

/** Rows from a query, or `[]` when the relation is not there yet. */
export async function safeRows<T>(
  run: PromiseLike<{ data: T[] | null; error: QueryError }>,
): Promise<T[]> {
  const { data, error } = await run
  if (error) {
    if (isMissingRelation(error)) return []
    throw error
  }
  return data ?? []
}

/** A single row, or `null` when absent or when the relation is not there yet. */
export async function safeRow<T>(
  run: PromiseLike<{ data: T | null; error: QueryError }>,
): Promise<T | null> {
  const { data, error } = await run
  if (error) {
    if (isMissingRelation(error)) return null
    throw error
  }
  return data
}
