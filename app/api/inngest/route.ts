import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { inngestFunctions } from "@/lib/inngest/functions"

/** Node runtime: long Inngest steps must not run on Edge (stricter timeouts). */
export const runtime = "nodejs"
/** Pro: up to 300s. Hobby is capped at 10s; upgrade or split steps if you still see FUNCTION_INVOCATION_TIMEOUT. */
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
})
