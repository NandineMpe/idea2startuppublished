import { CONTEXT_VAULT_SYNC_REQUESTED } from "@/lib/inngest/event-names"
import { inngest } from "@/lib/inngest/client"
import { supabaseAdmin } from "@/lib/supabase"
import { syncVaultContextCacheForUser } from "@/lib/vault-context-sync"

export const contextVaultSyncFanOut = inngest.createFunction(
  {
    id: "context-vault-sync-fanout",
    name: "Context: Vault Sync Fan-Out",
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step }) => {
    const users = await step.run("load-users", async () => {
      const { data, error } = await supabaseAdmin
        .from("company_profile")
        .select("user_id")
        .not("github_vault_repo", "is", null)
        .neq("github_vault_repo", "")

      if (error) {
        console.error("[context-vault-sync fanout]", error.message)
        return [] as string[]
      }

      return (data ?? []).map((row) => String(row.user_id))
    })

    if (users.length > 0) {
      await step.sendEvent(
        "fan-out-context-vault-sync",
        users.map((userId) => ({
          name: CONTEXT_VAULT_SYNC_REQUESTED,
          data: { userId },
        })),
      )
    }

    return { users: users.length }
  },
)

export const contextVaultSync = inngest.createFunction(
  {
    id: "context-vault-sync",
    name: "Context: Vault Sync",
    triggers: [{ event: CONTEXT_VAULT_SYNC_REQUESTED }],
    concurrency: { limit: 4 },
    retries: 1,
  },
  async ({ event, step }) => {
    const userId = String(event.data.userId ?? "")
    if (!userId) return { ok: false, reason: "missing_user_id" }

    return step.run("sync-vault-cache", async () => syncVaultContextCacheForUser(supabaseAdmin, userId))
  },
)
