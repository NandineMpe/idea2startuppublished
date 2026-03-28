"use client"

import { useCallback, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFrontendClient } from "@pipedream/sdk/browser"
import type { CreateTokenResponse } from "@pipedream/sdk"
import { FrontendClientProvider, useFrontendClient } from "@pipedream/connect-react"
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Github,
  Loader2,
  Lock,
  Plug,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type PdAccount = PipedreamAccountPublic

type RepoData = {
  connected: boolean
  githubLogin: string | null
  repos: { full_name: string; default_branch: string; private: boolean }[]
  reposFetchError: string | null
  reposEmptyLikelyScope?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function AccountHealthBadge({ account }: { account: PdAccount }) {
  if (account.dead) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
        <AlertCircle className="h-3 w-3" /> Dead — token expired
      </span>
    )
  }
  if (account.healthy === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
        <AlertCircle className="h-3 w-3" /> Unhealthy — reconnect recommended
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
      <CheckCircle2 className="h-3 w-3" /> Active
    </span>
  )
}

/** Exponential-backoff sync after Pipedream rotates the token on connect. */
async function syncAccountsAfterConnect(
  queryClient: ReturnType<typeof useQueryClient>,
  refetch: () => Promise<{ data?: unknown }>,
): Promise<boolean> {
  await queryClient.invalidateQueries({ queryKey: ["pipedream-accounts"] })
  const delays = [500, 900, 1600, 2800, 4000]
  for (const ms of delays) {
    await new Promise((r) => setTimeout(r, ms))
    await queryClient.invalidateQueries({ queryKey: ["pipedream-accounts"] })
    const result = await refetch()
    const rows = result.data
    if (Array.isArray(rows) && rows.length > 0) return true
  }
  return false
}

// ─── Main Card ────────────────────────────────────────────────────────────────

function GithubPipedreamCard({ userId }: { userId: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const client = useFrontendClient()
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

  // ── Accounts query ──────────────────────────────────────────────────────────
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
      const res = await fetch("/api/pipedream/accounts?app=github")
      const body = (await res.json().catch(() => ({}))) as { accounts?: PdAccount[]; error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
      return (body.accounts ?? []) as PdAccount[]
    },
    enabled: Boolean(userId),
  })

  // ── Repos query (lazy — only fires when expanded) ───────────────────────────
  const {
    data: repoData,
    isLoading: reposLoading,
    error: reposError,
    refetch: refetchRepos,
  } = useQuery<RepoData>({
    queryKey: ["github-repos", userId],
    queryFn: async () => {
      const res = await fetch("/api/security/github/repos")
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Failed to fetch repos (${res.status})`)
      }
      return res.json() as Promise<RepoData>
    },
    enabled: reposExpanded && accounts.length > 0,
    staleTime: 60_000,
  })

  // ── Derived state ───────────────────────────────────────────────────────────
  const connected = accounts.length > 0
  const hasUnhealthy = accounts.some((a) => a.dead || a.healthy === false)
  const allDead = accounts.length > 0 && accounts.every((a) => a.dead)
  const pipedreamLastActivity = latestPipedreamActivityIso(accounts)

  const runLiveVerify = useCallback(async () => {
    setVerifying(true)
    try {
      const res = await fetch("/api/pipedream/github-verify")
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

  const statusBusy =
    connecting || syncingAfterConnect || (Boolean(isFetching) && !connected && !isLoading)

  // ── Post-connect sync ───────────────────────────────────────────────────────
  const runPostConnectSync = useCallback(async () => {
    setSyncingAfterConnect(true)
    try {
      const ok = await syncAccountsAfterConnect(queryClient, () => refetch())
      if (ok) {
        toast({ title: "GitHub linked", description: "Connection is up to date." })
        // Invalidate repos so they reload with new account
        await queryClient.invalidateQueries({ queryKey: ["github-repos"] })
      } else {
        toast({
          title: "Connected — status may lag",
          description: "Pipedream saved the link. Reload if the banner still shows not connected.",
        })
      }
    } finally {
      setSyncingAfterConnect(false)
    }
  }, [queryClient, refetch, toast])

  // ── OAuth connect flow ──────────────────────────────────────────────────────
  const connect = async () => {
    setConnecting(true)
    try {
      await client.connectAccount({
        app: "github",
        onSuccess: () => {
          toast({ title: "GitHub authorized", description: "Finishing up…" })
        },
        onError: (err) => {
          toast({ title: "Connection issue", description: err.message, variant: "destructive" })
        },
        onClose: (status) => {
          setConnecting(false)
          if (status.successful) {
            void runPostConnectSync()
          } else if (status.completed && !status.successful) {
            toast({ title: "Not connected", description: "Window closed before finishing." })
          }
        },
      })
    } catch {
      setConnecting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Card className="glass-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5 text-foreground" />
          <CardTitle className="text-foreground">GitHub (Pipedream Connect)</CardTitle>
        </div>
        <CardDescription className="text-muted-foreground">
          Connect your GitHub account through Pipedream. Juno can use this for workflows and tools
          you enable in Pipedream.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Status banner ── */}
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
                allDead
                  ? "text-destructive"
                  : hasUnhealthy
                    ? "text-amber-500"
                    : "text-primary",
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
                ? `${accounts.length} GitHub ${accounts.length === 1 ? "account" : "accounts"} on file — all tokens expired. Reconnect below.`
                : hasUnhealthy
                  ? `${accounts.length} GitHub ${accounts.length === 1 ? "account" : "accounts"} on file — some need reconnecting.`
                  : `Connected — ${accounts.length} GitHub ${accounts.length === 1 ? "account" : "accounts"} on file for this workspace.`}
            </span>
          )}
          {!connected && isLoading && <span>Checking existing connection…</span>}
          {!connected && !isLoading && statusBusy && (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              {connecting ? "Complete sign-in in the Pipedream window…" : "Syncing connection status…"}
            </span>
          )}
          {!connected && !isLoading && !statusBusy && isFetched && (
            <span>Not connected yet. Use the button below to link GitHub.</span>
          )}
          {accountsError && (
            <span className="text-destructive block mt-1">
              Could not load status:{" "}
              {accountsError instanceof Error ? accountsError.message : "Unknown error"}
            </span>
          )}
        </div>

        {/* ── Account list ── */}
        {connected && !isLoading && accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-foreground">
                    {account.name ? `@${account.name}` : `Account ${account.id.slice(0, 8)}…`}
                  </span>
                  <AccountHealthBadge account={account} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                  {account.createdAt && <div>First linked: {formatDate(account.createdAt)}</div>}
                  {account.updatedAt && <div>Last updated (Pipedream): {formatDate(account.updatedAt)}</div>}
                  {account.lastRefreshedAt && (
                    <div>Credentials last refreshed: {formatDate(account.lastRefreshedAt)}</div>
                  )}
                  {account.nextRefreshAt && (
                    <div>Next credential refresh: {formatDate(account.nextRefreshAt)}</div>
                  )}
                  {account.expiresAt && <div>Access refresh by: {formatDate(account.expiresAt)}</div>}
                  {account.error && (
                    <div className="text-destructive">Pipedream: {account.error}</div>
                  )}
                </div>
              </div>
            ))}
            {pipedreamLastActivity && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                Latest Pipedream activity:{" "}
                <span className="font-medium text-foreground">{formatDate(pipedreamLastActivity)}</span>
              </p>
            )}

            <div className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Live verification (GitHub API)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Confirms this app can call GitHub on your behalf right now — stronger than “Pipedream has a row on
                file.”
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

        {/* ── Repos section ── */}
        {connected && !allDead && (
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              onClick={() => setReposExpanded((v) => !v)}
            >
              <Github className="h-4 w-4" />
              {reposExpanded ? "Hide accessible repos" : "Show accessible repos"}
            </button>

            {reposExpanded && (
              <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
                {reposLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching repos via Pipedream…
                  </div>
                )}

                {reposError && (
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Could not fetch repos</p>
                      <p className="text-xs mt-0.5">
                        {reposError instanceof Error ? reposError.message : "Unknown error"}
                      </p>
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
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">GitHub returned an error</p>
                          <p className="text-xs mt-0.5">{repoData.reposFetchError}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This usually means the OAuth token is expired — reconnect GitHub below.
                          </p>
                        </div>
                      </div>
                    )}

                    {repoData.reposEmptyLikelyScope && !repoData.reposFetchError && (
                      <div className="flex items-start gap-2 text-sm text-amber-500">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">No repos returned</p>
                          <p className="text-xs mt-0.5 text-muted-foreground">
                            The OAuth grant may be missing the <code>repo</code> scope. Reconnect
                            GitHub to re-authorise with full access.
                          </p>
                        </div>
                      </div>
                    )}

                    {repoData.repos.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {repoData.repos.length} repo{repoData.repos.length !== 1 ? "s" : ""} accessible
                            {repoData.githubLogin && ` as @${repoData.githubLogin}`}
                          </p>
                          <button
                            type="button"
                            title="Refresh repo list"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => void refetchRepos()}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <ul className="max-h-52 overflow-y-auto space-y-1 pr-1">
                          {repoData.repos.map((repo) => (
                            <li
                              key={repo.full_name}
                              className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted/30"
                            >
                              {repo.private ? (
                                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <Unlock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="font-mono text-xs text-foreground truncate">
                                {repo.full_name}
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                {repo.default_branch}
                              </span>
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

        {/* ── Actions ── */}
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
                : "Opens Pipedream to sign in."}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Uses Pipedream&apos;s hosted OAuth. You can disconnect from Pipedream project settings if
          needed.
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Provider wrapper ─────────────────────────────────────────────────────────

export function IntegrationsPageClient({
  userId,
  pipedreamReady,
  pipedreamProjectEnvironment,
}: {
  userId: string
  pipedreamReady: boolean
  pipedreamProjectEnvironment?: "development" | "production"
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

  const pdClient = useMemo(() => {
    if (!pipedreamReady) return null
    return createFrontendClient({
      externalUserId: userId,
      projectEnvironment:
        pipedreamProjectEnvironment ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
      tokenCallback: async (): Promise<CreateTokenResponse> => {
        const res = await fetch("/api/pipedream/connect-token", { method: "POST" })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || "Could not create Connect token")
        }
        const data = (await res.json()) as {
          token: string
          expiresAt: string
          connectLinkUrl: string
        }
        return {
          token: data.token,
          connectLinkUrl: data.connectLinkUrl,
          expiresAt: new Date(data.expiresAt),
        }
      },
    })
  }, [userId, pipedreamReady, pipedreamProjectEnvironment])

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external accounts. More integrations will show up here as we ship them.
        </p>
      </div>

      {pipedreamReady && pdClient ? (
        <QueryClientProvider client={queryClient}>
          <FrontendClientProvider client={pdClient}>
            <GithubPipedreamCard userId={userId} />
          </FrontendClientProvider>
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
            <ul className="text-sm text-muted-foreground space-y-1 font-mono list-disc pl-5">
              <li>PIPEDREAM_CLIENT_ID</li>
              <li>PIPEDREAM_CLIENT_SECRET</li>
              <li>PIPEDREAM_PROJECT_ID</li>
              <li>PIPEDREAM_ALLOWED_ORIGINS (JSON array, e.g. [&quot;https://your-domain.vercel.app&quot;])</li>
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Obsidian vault (GitHub repo)</h2>
        <p className="text-sm text-muted-foreground">
          Separate from Connect: grant repo access for the knowledge vault Juno reads. Uses a
          personal access token and repo fields below.
        </p>
        <GithubVaultSettings />
      </div>
    </div>
  )
}
