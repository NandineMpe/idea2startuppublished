import { serve } from "inngest/next"
import { careerosInngest } from "@/lib/careeros/inngest/client"
import { marketCacheRefresh } from "@/lib/careeros/inngest/functions/market-cache-refresh"
import { systemPing } from "@/lib/careeros/inngest/functions/system-ping"

export const runtime = "nodejs"
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: careerosInngest,
  functions: [systemPing, marketCacheRefresh],
})
