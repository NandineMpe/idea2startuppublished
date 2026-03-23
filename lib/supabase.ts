import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role and anon clients — **lazy** so `next build` / page data collection
 * does not fail when env is only available at runtime (e.g. Vercel production).
 */
let supabaseInstance: SupabaseClient | null = null
let supabaseAdminInstance: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
    }
    supabaseInstance = createClient(url, key)
  }
  return supabaseInstance
}

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    }
    supabaseAdminInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabaseAdminInstance
}

function proxyClient(getter: () => SupabaseClient): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_, prop) {
      const client = getter()
      const v = Reflect.get(client as object, prop, client)
      if (typeof v === "function") {
        return v.bind(client)
      }
      return v
    },
  })
}

export const supabase = proxyClient(getSupabase)
export const supabaseAdmin = proxyClient(getSupabaseAdmin)
