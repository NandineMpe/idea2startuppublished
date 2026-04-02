import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPipedreamProjectEnvironment } from "@/lib/pipedream-connect-env"
import { IntegrationsPageClient } from "@/components/dashboard/integrations-page-client"

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const pipedreamReady =
    !!process.env.PIPEDREAM_CLIENT_ID &&
    !!process.env.PIPEDREAM_CLIENT_SECRET &&
    !!process.env.PIPEDREAM_PROJECT_ID

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <IntegrationsPageClient
        userId={user.id}
        pipedreamReady={pipedreamReady}
        pipedreamProjectEnvironment={pipedreamReady ? getPipedreamProjectEnvironment() : undefined}
        githubOauthAppId={process.env.PIPEDREAM_GITHUB_OAUTH_APP_ID || undefined}
        xSearchReady={Boolean(process.env.X_BEARER_TOKEN?.trim())}
      />
    </div>
  )
}
