/**
 * Users to run Juno background jobs for.
 * - If `JUNO_TEST_USER_ID` is set, only that user (local / staging).
 * - Else lists auth users via service role (production fan-out).
 */
export async function getJunoTargetUserIds(): Promise<string[]> {
  const test = process.env.JUNO_TEST_USER_ID?.trim()
  if (test) return [test]

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[juno] No SUPABASE_SERVICE_ROLE_KEY and no JUNO_TEST_USER_ID — no users to process.")
    return []
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase")
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (error) {
      console.error("[juno] listUsers:", error.message)
      return []
    }
    return (data.users ?? []).map((u) => u.id)
  } catch (e) {
    console.error("[juno] listUsers exception:", e)
    return []
  }
}
