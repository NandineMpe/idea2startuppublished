"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Github,
  Loader2,
  Lock,
  Plug,
  Radio,
  RefreshCw,
  ShieldCheck,
  Unlock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { GithubVaultSettings } from "@/components/dashboard/github-vault-settings"
import { cn } from "@/lib/utils"
import type { PipedreamAccountPublic } from "@/lib/pipedream-serialize-account"
import { latestPipedreamActivityIso } from "@/lib/pipedream-serialize-account"

type PdAccount = PipedreamAccountPublic

type RepoData = {
  connected: boolean
  githubLogin: string | null
  repos: { full_name: string; default_branch: string; private: boolean }[]
  reposFetchError: string | null
  reposEmptyLikelyScope?: boolean
}

type ConnectTokenResponse = {
  token?: string
  connectLinkUrl?: string
  expiresAt?: string
  externalUserId?: string
  error?: string
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-"
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function accountFingerprint(account: PdAccount | null): string | null {
  if (!account) return null
  return [
    account.id,
    account.createdAt ?? "",
    account.updatedAt ?? "",
    account.lastRefreshedAt ?? "",
    account.expiresAt ?? "",
    String(account.dead),
    String(account.healthy),
    account.error ?? "",
  ].join("|")
}

function buildGithubConnectUrl(token: string, githubOauthAppId?: string): string {
  const url = new URL("https://pipedream.com/_static/connect.html")
  url.searchParams.set("token", token)
  url.searchParams.set("app", "github")
  if (githubOauthAppId) {
    url.searchParams.set("oauthAppId", githubOauthAppId)
  }
  return url.toString()
}

function sanitizeReturnPath(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith("/")) return null
  if (value.startsWith("//")) return null
  return value
}

function AccountHealthBadge({ account }: { account: PdAccount }) {
  if (account.dead) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertCircle className="h-3 w-3" /> Dead - token expired
      </span>
    )
  }
  if (account.healthy === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
        <AlertCircle className="h-3 w-3" /> Unhealthy - reconnect recommended
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <CheckCircle2 className="h-3 w-3" /> Active
    </span>
  )
}

async function syncAccountsAfterConnect(
  queryClient: ReturnType<typeof useQueryClient>,
  refetch: () => Promise<{ data?: unknown }>,
): Promise<boolean> {
  await queryClient.invalidateQueries({ queryKey: ["pipedream-accounts"] })
  const delays = [500, 900, 1600, 2800, 4000]
  for (const ms of delays) {
    await new Promise((resolve) => setTimeout(resolve, ms))
    await queryClient.invalidateQueries({ queryKey: ["pipedream-accounts"] })
    const result = await refetch()
    const rows = result.data
    if (Array.isArray(rows) && rows.length > 0) return true
  }
  return false
}

function GithubPipedreamCard({ userId, githubOauthAppId }: { userId: string; githubOauthAppId?: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closeCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [syncingAfterConnect, setSyncingAfterConnect] = useState(false)
  const [reposExpanded, setReposExpanded] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [liveVerify, setLiveVerify] = useState<{
    ok: boolean
    githubLogin: string | null
    verifiedAt: string
    error?: string
  } | null>(null)

  const returnPath = useMemo(() => sanitizeReturnPath(searchParams.get("return")), [searchParams])
  const launchedFromConnectRedirect = searchParams.get("connect") === "github"

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (closeCheckRef.current) clearInterval(closeCheckRef.current)
      popupRef.current?.close()
    }
  }, [])

  const {
    data: accounts = [],
    isLoading,
    refetch,
    isFetching,
    isFetched,
    error: accountsError,
  } = useQuery<PdAccount[]>({
    queryKey: ["pipedream-accounts", userId],
    queryFn: async () => {
      const res = await fetch("/api/pipedream/accounts?app=github", { credentials: "include" })
      const body = (await res.json().catch(() => ({}))) as { accounts?: PdAccount[]; error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
      return (body.accounts ?? []) as PdAccount[]
    },
    enabled: Boolean(userId),
  })

  const {
    data: repoData,
    isLoading: reposLoading,
    error: reposError,
    refetch: refetchRepos,
  } = useQuery<RepoData>({
    queryKey: ["github-repos", userId],
    queryFn: async () => {
      const res = await fetch("/api/security/github/repos", { credentials: "include" })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Failed to fetch repos (${res.status})`)
      }
      return res.json() as Promise<RepoData>
    },
    enabled: reposExpanded && accounts.length > 0,
    staleTime: 60_000,
  })

  const primaryAccount = accounts[0] ?? null
  const connected = Boolean(primaryAccount)
  const hasUnhealthy = Boolean(primaryAccount && (primaryAccount.dead || primaryAccount.healthy === false))
  const allDead = Boolean(primaryAccount?.dead)
  const pipedreamLastActivity = latestPipedreamActivityIso(primaryAccount ? [primaryAccount] : [])

  const runLiveVerify = useCallback(async () => {
    setVerifying(true)
    try {
      const res = await fetch("/api/pipedream/github-verify", { credentials: "include" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        githubLogin?: string | null
        verifiedAt?: string
        error?: string
      }
      if (!res.ok) {
        setLiveVerify({
          ok: false,
          githubLogin: null,
          verifiedAt: new Date().toISOString(),
          error: typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        })
        return
      }
      setLiveVerify({
        ok: Boolean(data.ok),
        githubLogin: data.githubLogin ?? null,
        verifiedAt: data.verifiedAt ?? new Date().toISOString(),
        error: data.ok ? undefined : data.error,
      })
    } finally {
      setVerifying(false)
    }
  }, [])

  const statusBusy = connecting || syncingAfterConnect || (Boolean(isFetching) && !connected && !isLoading)

  const runPostConnectSync = useCallback(
    async (nextPath?: string | null) => {
      setSyncingAfterConnect(true)
      try {
        const ok = await syncAccountsAfterConnect(queryClient, () => refetch())
        if (ok) {
          toast({ title: "GitHub linked", description: "Connection is up to date." })
          await queryClient.invalidateQueries({ queryKey: ["github-repos"] })
          if (nextPath) {
            router.push(nextPath)
          }
        } else {
          toast({
            title: "Connected - status may lag",
            description: "Pipedream saved the link. Reload if the banner still shows not connected.",
          })
        }
      } finally {
        setSyncingAfterConnect(false)
      }
    },
    [queryClient, refetch, router, toast],
  )

  const fetchLatestGithubAccount = useCallback(async (): Promise<PdAccount | null> => {
    const res = await fetch("/api/pipedream/accounts?app=github", { credentials: "include" })
    if (!res.ok) return null
    const body = (await res.json().catch(() => ({}))) as { accounts?: PdAccount[] }
    return body.accounts?.[0] ?? null
  }, [])

  const connect = useCallback(async () => {
    if (connecting) return

    const baselineFingerprint = accountFingerprint(primaryAccount)

    if (pollRef.current) clearInterval(pollRef.current)
    if (closeCheckRef.current) clearInterval(closeCheckRef.current)
    popupRef.current?.close()

    const popup = window.open(
      "",
      "pipedream-connect",
      "width=620,height=700,toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1",
    )

    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Allow popups for this site and try again.",
        variant: "destructive",
      })
      return
    }

    popup.document.title = "Connecting GitHub..."
    popup.document.body.innerHTML =
      "<p style=\"font-family: sans-serif; padding: 24px;\">Opening Pipedream Connect...</p>"
    popupRef.current = popup
    setConnecting(true)

    let resolved = false

    const finishConnect = async (account: PdAccount | null) => {
      if (resolved) return
      if (!account) return
      if (accountFingerprint(account) === baselineFingerprint) return

      resolved = true
      if (pollRef.current) clearInterval(pollRef.current)
      if (closeCheckRef.current) clearInterval(closeCheckRef.current)
      popupRef.current?.close()
      setConnecting(false)
      toast({ title: "GitHub authorized", description: "Finishing up..." })
      await runPostConnectSync(returnPath)
    }

    try {
      const res = await fetch("/api/pipedream/connect-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalUserId: userId }),
      })
      const body = (await res.json().catch(() => ({}))) as ConnectTokenResponse
      if (!res.ok) {
        popup.close()
        throw new Error(body.error || `Token request failed (${res.status})`)
      }
      if (body.externalUserId && body.externalUserId !== userId) {
        popup.close()
        throw new Error("Connect token user mismatch. Sign out and back in, then try again.")
      }
      if (!body.token) {
        popup.close()
        throw new Error("Connect token response was incomplete.")
      }

      popup.location.href = buildGithubConnectUrl(body.token, githubOauthAppId)

      pollRef.current = setInterval(async () => {
        const latest = await fetchLatestGithubAccount().catch(() => null)
        await finishConnect(latest)
      }, 2000)

      closeCheckRef.current = setInterval(async () => {
        if (!popup.closed) return
        if (pollRef.current) clearInterval(pollRef.current)
        if (closeCheckRef.current) clearInterval(closeCheckRef.current)

        const latest = await fetchLatestGithubAccount().catch(() => null)
        if (latest && accountFingerprint(latest) !== baselineFingerprint) {
          await finishConnect(latest)
          return
        }

        setConnecting(false)
        if (!resolved) {
          toast({ title: "Not connected", description: "Window closed before finishing." })
        }
      }, 800)
    } catch (error) {
      if (pollRef.current) clearInterval(pollRef.current)
      if (closeCheckRef.current) clearInterval(closeCheckRef.current)
      popup.close()
      setConnecting(false)
      toast({
        title: "Connection issue",
        description: error instanceof Error ? error.message : "Could not start the connect flow.",
        variant: "destructive",
      })
    }
  }, [
    connecting,
    fetchLatestGithubAccount,
    githubOauthAppId,
    primaryAccount,
    returnPath,
    runPostConnectSync,
    toast,
    userId,
  ])

  return (
    <Card className="glass-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5 text-foreground" />
          <CardTitle className="text-foreground">GitHub (Pipedream Connect)</CardTitle>
        </div>
        <CardDescription className="text-muted-foreground">
          Use <span className="font-medium text-foreground">Connect GitHub</span> below so the account is tied to your
          Juno login (Pipedream <code className="text-xs">external_user_id</code>). OAuth connections made only inside
          the Pipedream workspace are not linked to your user here.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {launchedFromConnectRedirect && !connected && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-foreground">
            Finish GitHub connection below.
            {returnPath ? " After success, you will return to the page you came from." : ""}
          </div>
        )}

        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            connected && !allDead
              ? hasUnhealthy
                ? "border-amber-500/30 bg-amber-500/5 text-foreground"
                : "border-primary/30 bg-primary/5 text-foreground"
              : "border-border bg-muted/30 text-muted-foreground",
          )}
          role="status"
          aria-live="polite"
        >
          {connected && !isLoading && (
            <span
              className={cn(
                "inline-flex items-center gap-2 font-medium",
                allDead ? "text-destructive" : hasUnhealthy ? "text-amber-500" : "text-primary",
              )}
            >
              {allDead ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : hasUnhealthy ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              {allDead
                ? "GitHub link on file - token expired. Reconnect below."
                : hasUnhealthy
                  ? "Connection needs attention - reconnect below to refresh OAuth."
                  : primaryAccount?.name
                    ? `Connected as @${primaryAccount.name}.`
                    : "GitHub connected for this workspace."}
            </span>
          )}
          {!connected && isLoading && <span>Checking existing connection...</span>}
          {!connected && !isLoading && statusBusy && (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              {connecting ? "Complete sign-in in the Pipedream window..." : "Syncing connection status..."}
            </span>
          )}
          {!connected && !isLoading && !statusBusy && isFetched && (
            <span>Not connected yet. Use the button below to link GitHub.</span>
          )}
          {accountsError && (
            <span className="mt-1 block text-destructive">
              Could not load status: {accountsError instanceof Error ? accountsError.message : "Unknown error"}
            </span>
          )}
        </div>

        {connected && !isLoading && primaryAccount && (
          <div className="space-y-2">
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {primaryAccount.name ? `@${primaryAccount.name}` : `Account ${primaryAccount.id.slice(0, 8)}...`}
                </span>
                <AccountHealthBadge account={primaryAccount} />
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {primaryAccount.updatedAt && <div>Last updated (Pipedream): {formatDate(primaryAccount.updatedAt)}</div>}
                {primaryAccount.lastRefreshedAt && (
                  <div>Credentials last refreshed: {formatDate(primaryAccount.lastRefreshedAt)}</div>
                )}
                {primaryAccount.expiresAt && <div>Access refresh by: {formatDate(primaryAccount.expiresAt)}</div>}
                {primaryAccount.error && <div className="text-destructive">Pipedream: {primaryAccount.error}</div>}
              </div>
            </div>

            {pipedreamLastActivity && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                Latest activity: <span className="font-medium text-foreground">{formatDate(pipedreamLastActivity)}</span>
              </p>
            )}

            <div className="space-y-2 rounded-lg border border-border bg-background/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Live verification (GitHub API)
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Confirms this app can call GitHub on your behalf right now - stronger than "Pipedream has a row on
                file."
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5"
                disabled={verifying || allDead}
                onClick={() => void runLiveVerify()}
              >
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Verify with GitHub now
              </Button>
              {liveVerify && (
                <div
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-[11px]",
                    liveVerify.ok && liveVerify.githubLogin
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100"
                      : "border-destructive/30 bg-destructive/5 text-destructive",
                  )}
                >
                  {liveVerify.ok ? (
                    liveVerify.githubLogin ? (
                      <>
                        Verified as <span className="font-mono font-semibold">@{liveVerify.githubLogin}</span> at{" "}
                        {formatDate(liveVerify.verifiedAt)}.
                      </>
                    ) : (
                      <>GitHub API responded OK at {formatDate(liveVerify.verifiedAt)}.</>
                    )
                  ) : (
                    <>
                      {liveVerify.error ?? "Could not reach GitHub with this connection."} (checked at{" "}
                      {formatDate(liveVerify.verifiedAt)}).
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {connected && !allDead && (
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
              onClick={() => setReposExpanded((value) => !value)}
            >
              <Github className="h-4 w-4" />
              {reposExpanded ? "Hide accessible repos" : "Show accessible repos"}
            </button>

            {reposExpanded && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3">
                {reposLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching repos via Pipedream...
                  </div>
                )}

                {reposError && (
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Could not fetch repos</p>
                      <p className="mt-0.5 text-xs">{reposError instanceof Error ? reposError.message : "Unknown error"}</p>
                      <button
                        type="button"
                        className="mt-1 text-xs underline underline-offset-2 hover:text-foreground"
                        onClick={() => void refetchRepos()}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {repoData && !reposLoading && (
                  <>
                    {repoData.reposFetchError && (
                      <div className="flex items-start gap-2 text-sm text-amber-500">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">GitHub returned an error</p>
                          <p className="mt-0.5 text-xs">{repoData.reposFetchError}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            This usually means the OAuth token is expired - reconnect GitHub below.
                          </p>
                        </div>
                      </div>
                    )}

                    {repoData.reposEmptyLikelyScope && !repoData.reposFetchError && (
                      <div className="flex items-start gap-2 text-sm text-amber-500">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">No repos returned</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            The OAuth grant may be missing the <code>repo</code> scope. Reconnect GitHub to re-authorize
                            with full access.
                          </p>
                        </div>
                      </div>
                    )}

                    {repoData.repos.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {repoData.repos.length} repo{repoData.repos.length !== 1 ? "s" : ""} accessible
                            {repoData.githubLogin && ` as @${repoData.githubLogin}`}
                          </p>
                          <button
                            type="button"
                            title="Refresh repo list"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => void refetchRepos()}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <ul className="max-h-52 space-y-1 overflow-y-auto pr-1">
                          {repoData.repos.map((repo) => (
                            <li
                              key={repo.full_name}
                              className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/30"
                            >
                              {repo.private ? (
                                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <Unlock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="truncate font-mono text-xs text-foreground">{repo.full_name}</span>
                              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{repo.default_branch}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void connect()}
            disabled={connecting || syncingAfterConnect || isLoading}
            className="gap-2"
          >
            {connecting || syncingAfterConnect ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            {connected ? "Reconnect GitHub" : "Connect GitHub"}
          </Button>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {connected
                ? hasUnhealthy || allDead
                  ? "Reconnect to refresh expired OAuth tokens."
                  : "Reconnect to switch accounts or refresh the OAuth grant."
                : "Opens Pipedream in a real popup OAuth flow."}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Uses Pipedream's hosted OAuth in a popup and then verifies the saved connection from the server.
        </p>
      </CardContent>
    </Card>
  )
}

function XMonitoringCard({ xSearchReady }: { xSearchReady: boolean }) {
  return (
    <Card className="glass-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-foreground" />
          <CardTitle className="text-foreground">X search monitoring</CardTitle>
        </div>
        <CardDescription className="text-muted-foreground">
          Luckmaxxing uses app-level X recent-search access for discovery. This is separate from founder posting or
          reply workflows.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            xSearchReady
              ? "border-primary/30 bg-primary/5 text-foreground"
              : "border-border bg-muted/30 text-muted-foreground",
          )}
        >
          {xSearchReady ? (
            <span className="inline-flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              X recent search is configured for this deployment.
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              X recent search is not configured yet.
            </span>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-background/30 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">What this powers</p>
          <p>Find public posts that mention a target company, keyword, or pain signal and feed the strongest hits into Luckmaxxing.</p>
          <p>It does not require each founder to connect an X account just to monitor public opportunity threads.</p>
        </div>

        {!xSearchReady ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Add <code className="text-xs">X_BEARER_TOKEN</code> to the deployment environment, then reload this page.
          </div>
        ) : null}

        <a href="/dashboard/luckmaxxing" className="inline-flex text-sm font-medium text-primary hover:text-primary/80">
          Open Luckmaxxing
        </a>
      </CardContent>
    </Card>
  )
}

export function IntegrationsPageClient({
  userId,
  pipedreamReady,
  githubOauthAppId,
  xSearchReady,
}: {
  userId: string
  pipedreamReady: boolean
  pipedreamProjectEnvironment?: "development" | "production"
  githubOauthAppId?: string
  xSearchReady: boolean
}) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
    [],
  )

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external accounts. More integrations will show up here as we ship them.
        </p>
      </div>

      {pipedreamReady ? (
        <QueryClientProvider client={queryClient}>
          <GithubPipedreamCard userId={userId} githubOauthAppId={githubOauthAppId} />
        </QueryClientProvider>
      ) : (
        <Card className={cn("glass-card border-border border-dashed")}>
          <CardHeader>
            <CardTitle className="text-foreground">Pipedream Connect</CardTitle>
            <CardDescription className="text-muted-foreground">
              Add these to your deployment environment (e.g. Vercel), then reload:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 font-mono text-sm text-muted-foreground">
              <li>PIPEDREAM_CLIENT_ID</li>
              <li>PIPEDREAM_CLIENT_SECRET</li>
              <li>PIPEDREAM_PROJECT_ID</li>
              <li>PIPEDREAM_PROJECT_ENVIRONMENT</li>
              <li>PIPEDREAM_ALLOWED_ORIGINS (JSON array, e.g. [&quot;https://your-domain.vercel.app&quot;])</li>
            </ul>
          </CardContent>
        </Card>
      )}

      <XMonitoringCard xSearchReady={xSearchReady} />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Obsidian vault (GitHub repo)</h2>
        <p className="text-sm text-muted-foreground">
          Separate from Connect: grant repo access for the knowledge vault Juno reads. Uses a personal access token and
          repo fields below.
        </p>
        <GithubVaultSettings />
      </div>
    </div>
  )
}
