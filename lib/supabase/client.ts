import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pvdpwpextjdoghfuusrd.supabase.co",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_raYAFG0lYJqSiZBtBc2Icw_26NMAJpX"
    )
}
