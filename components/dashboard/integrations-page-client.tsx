"use client"

import React, { useCallback, useMemo, useState } from "react"
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
  Link2,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

type AppDefinition = {
  slug: string
  name: string
  description: string
  logo: React.ReactNode
  category: string
  comingSoon?: boolean
}

// ─── App logos (inline SVG) ───────────────────────────────────────────────────

function GithubLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

function SlackLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
    </svg>
  )
}

function GmailLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
    </svg>
  )
}

function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <path d="M18 0H6L0 6v12l6 6h12l6-6V6L18 0z" fill="#fff"/>
      <path d="M18 0H6v6H0v12h6v6h12v-6h6V6h-6V0z" fill="#fff"/>
      <rect x="6" y="6" width="12" height="12" rx="1" fill="#fff" stroke="#4285F4" strokeWidth="0.5"/>
      <path d="M17.5 3h-11A3.5 3.5 0 0 0 3 6.5v11A3.5 3.5 0 0 0 6.5 21h11a3.5 3.5 0 0 0 3.5-3.5v-11A3.5 3.5 0 0 0 17.5 3z" fill="#fff"/>
      <path d="M17.5 3h-11A3.5 3.5 0 0 0 3 6.5V9h18V6.5A3.5 3.5 0 0 0 17.5 3z" fill="#4285F4"/>
      <path d="M3 9v8.5A3.5 3.5 0 0 0 6.5 21H9V9H3z" fill="#34A853"/>
      <path d="M9 21h6v-6H9v6z" fill="#FBBC05"/>
      <path d="M21 9h-6v6h6V9z" fill="#EA4335"/>
      <path d="M15 21h2.5A3.5 3.5 0 0 0 21 17.5V15h-6v6z" fill="#188038"/>
      <path d="M3 9V6.5A3.5 3.5 0 0 1 6.5 3H9v6H3z" fill="#1967D2"/>
      <text x="12" y="17" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#1967D2">
        {new Date().getDate()}
      </text>
    </svg>
  )
}

function NotionLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
    </svg>
  )
}

function TwitterLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function LinkedInLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

function HubSpotLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#FF7A59">
      <path d="M22.162 5.656a8.384 8.384 0 0 0-3.127-2.027 8.37 8.37 0 0 0-3.899-.463A8.402 8.402 0 0 0 11.57 4.45a8.354 8.354 0 0 0-2.49 2.76 8.337 8.337 0 0 0-.877 3.565 8.407 8.407 0 0 0 .54 3.75 8.39 8.39 0 0 0 2.163 3.046l-2.826 4.892a1.56 1.56 0 0 0 .57 2.133 1.567 1.567 0 0 0 2.135-.569l2.824-4.889a8.416 8.416 0 0 0 3.677.606 8.39 8.39 0 0 0 3.615-1.044 8.368 8.368 0 0 0 2.73-2.61 8.35 8.35 0 0 0 1.316-3.62 8.44 8.44 0 0 0-.34-3.786 8.39 8.39 0 0 0-2.405-3.224zM12 15.9a3.9 3.9 0 1 1 0-7.8 3.9 3.9 0 0 1 0 7.8z"/>
    </svg>
  )
}

function AirtableLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <path d="M11.155.5L1.09 4.405c-.53.212-.526.96.007 1.166L11.17 9.5c.538.208 1.122.208 1.66 0l10.072-3.929c.533-.208.537-.954.007-1.166L12.845.5a2.344 2.344 0 0 0-1.69 0z" fill="#FCB400"/>
      <path d="M12.83 12.562v9.952c0 .59.613 1 1.157.778l11.25-4.356a.844.844 0 0 0 .532-.778V8.206c0-.59-.613-1-1.157-.778l-11.25 4.356a.844.844 0 0 0-.532.778z" fill="#18BFFF"/>
      <path d="M10.613 13.052L7.155 14.51 6.99 14.58 1.06 17.062a.844.844 0 0 1-1.19-.764v-8.09c0-.312.17-.574.41-.718a.84.84 0 0 1 .84-.034l.462.194 2.476 1.036 3.932 1.648.985.413a.918.918 0 0 1 .638.855v.854a.918.918 0 0 1-.6.857v-.061z" fill="#F82B60"/>
    </svg>
  )
}

function GoogleSheetsLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <path d="M14.727 0H3.272A1.09 1.09 0 0 0 2.182 1.09v21.82A1.09 1.09 0 0 0 3.273 24h17.454a1.09 1.09 0 0 0 1.091-1.09V7.09L14.727 0z" fill="#23A566"/>
      <path d="M14.727 0v7.09h7.091L14.727 0z" fill="#1C8C57"/>
      <path d="M6.545 11.455h10.91v1.363H6.545zm0 2.727h10.91v1.363H6.545zm0 2.727h7.273v1.363H6.545z" fill="#fff"/>
    </svg>
  )
}

function StripeLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#635BFF">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
    </svg>
  )
}

function ShopifyLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#96BF48">
      <path d="M15.337.903s-.142.041-.374.124a5.988 5.988 0 0 0-.366-1.027C14.235-.764 13.5.15 13.5.15s-.413-.166-.88-.166c-.342 0-.65.083-.916.228-.278-.7-.74-1.16-1.304-1.16-1.923 0-2.847 2.406-3.136 3.63-.748.233-1.276.398-1.342.42-.415.13-.428.143-.483.534C5.392 3.854 3 21.8 3 21.8l14.017 2.2V.756l-1.68.147zM12.5 1.053c-.45.14-.96.297-1.5.466.29-1.116.845-1.655 1.32-1.864.135.367.234.895.18 1.398zm-.78 4.714l1.853-.574c-.002-.003-.433-2.2-.956-2.88.617.04 1.076.614 1.35 1.25l.606-.188s-.17-1.78-1.432-2.214c.226-.7.697-1.232 1.287-1.455L12.5 1.053C12.198.13 11.55-.47 10.7-.47c-1.71 0-2.547 2.14-2.82 3.21l-2.39.74S3 21.8 3 21.8l14.017 2.2V.903l-5.297.864z"/>
    </svg>
  )
}

function DiscordLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

function ZohoCRMLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#E42527">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 7.5H6.438a.937.937 0 0 0-.938.938v7.124c0 .518.42.938.938.938h11.124a.937.937 0 0 0 .938-.938V8.438A.937.937 0 0 0 17.562 7.5zm-5.624 7.5L7.5 10.5h9l-4.562 4.5z"/>
    </svg>
  )
}

function ZohoMailLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <rect width="24" height="24" rx="4" fill="#E42527"/>
      <path d="M4 8l8 5 8-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="4" y="7" width="16" height="11" rx="1.5" stroke="#fff" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}

// ─── App catalog ──────────────────────────────────────────────────────────────

const APPS: AppDefinition[] = [
  {
    slug: "github",
    name: "GitHub",
    description: "Access repos, trigger workflows, and let Juno act on your codebase via Pipedream.",
    logo: <GithubLogo />,
    category: "Developer",
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Post messages, read channels, and trigger automations from your Slack workspace.",
    logo: <SlackLogo />,
    category: "Communication",
  },
  {
    slug: "gmail",
    name: "Gmail",
    description: "Send and read emails, manage labels, and automate inbox workflows.",
    logo: <GmailLogo />,
    category: "Email",
  },
  {
    slug: "google_calendar",
    name: "Google Calendar",
    description: "Create events, check availability, and sync meeting data.",
    logo: <GoogleCalendarLogo />,
    category: "Productivity",
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Create pages, update databases, and sync notes into your workspace.",
    logo: <NotionLogo />,
    category: "Productivity",
  },
  {
    slug: "twitter",
    name: "X (Twitter)",
    description: "Post tweets, monitor mentions, and engage with your audience.",
    logo: <TwitterLogo />,
    category: "Social",
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    description: "Share posts, track engagement, and manage your professional presence.",
    logo: <LinkedInLogo />,
    category: "Social",
  },
  {
    slug: "hubspot",
    name: "HubSpot",
    description: "Sync contacts, track deals, and automate CRM workflows.",
    logo: <HubSpotLogo />,
    category: "CRM",
  },
  {
    slug: "airtable",
    name: "Airtable",
    description: "Read and write records, automate table updates, and sync structured data.",
    logo: <AirtableLogo />,
    category: "Data",
  },
  {
    slug: "google_sheets",
    name: "Google Sheets",
    description: "Read rows, append data, and automate spreadsheet workflows.",
    logo: <GoogleSheetsLogo />,
    category: "Data",
  },
  {
    slug: "stripe",
    name: "Stripe",
    description: "Monitor payments, manage customers, and automate billing workflows.",
    logo: <StripeLogo />,
    category: "Finance",
  },
  {
    slug: "shopify",
    name: "Shopify",
    description: "Sync orders, manage products, and automate your store.",
    logo: <ShopifyLogo />,
    category: "E-commerce",
  },
  {
    slug: "discord",
    name: "Discord",
    description: "Send messages, manage channels, and automate community interactions.",
    logo: <DiscordLogo />,
    category: "Communication",
  },
  {
    slug: "zoho_crm",
    name: "Zoho CRM",
    description: "Sync leads, contacts, and deals. Automate CRM workflows and track your pipeline.",
    logo: <ZohoCRMLogo />,
    category: "CRM",
  },
  {
    slug: "zoho_mail",
    name: "Zoho Mail",
    description: "Send and read emails, manage folders, and automate inbox workflows.",
    logo: <ZohoMailLogo />,
    category: "Email",
  },
]

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

function accountActivityMs(a: PdAccount): number {
  const candidates = [a.lastRefreshedAt, a.updatedAt, a.createdAt].filter(Boolean) as string[]
  let best = 0
  for (const s of candidates) {
    const t = Date.parse(s)
    if (!Number.isNaN(t) && t > best) best = t
  }
  return best
}

function pickPrimaryAccount(accounts: PdAccount[]): { primary: PdAccount; duplicateRows: number } {
  if (accounts.length === 0) throw new Error("pickPrimaryAccount: empty")
  const byName = new Map<string, PdAccount[]>()
  for (const a of accounts) {
    const key = a.name?.trim() ? a.name.trim().toLowerCase() : `__id_${a.id}`
    const arr = byName.get(key) ?? []
    arr.push(a)
    byName.set(key, arr)
  }
  const bestPerIdentity: PdAccount[] = []
  for (const group of byName.values()) {
    bestPerIdentity.push(group.reduce((x, y) => (accountActivityMs(y) > accountActivityMs(x) ? y : x)))
  }
  const primary = bestPerIdentity.reduce((x, y) => (accountActivityMs(y) > accountActivityMs(x) ? y : x))
  const duplicateRows = Math.max(0, accounts.length - bestPerIdentity.length)
  return { primary, duplicateRows }
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

// ─── Generic App Connect Card ─────────────────────────────────────────────────

function AppConnectCard({ userId, app }: { userId: string; app: AppDefinition }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const client = useFrontendClient()
  const [connecting, setConnecting] = useState(false)
  const [syncingAfterConnect, setSyncingAfterConnect] = useState(false)

  const {
    data: accounts = [],
    isLoading,
    refetch,
    isFetching,
    isFetched,
    error: accountsError,
  } = useQuery<PdAccount[]>({
    queryKey: ["pipedream-accounts", userId, app.slug],
    queryFn: async () => {
      const res = await fetch(`/api/pipedream/accounts?app=${encodeURIComponent(app.slug)}`)
      const body = (await res.json().catch(() => ({}))) as { accounts?: PdAccount[]; error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
      return (body.accounts ?? []) as PdAccount[]
    },
    enabled: Boolean(userId),
  })

  const connected = accounts.length > 0
  const hasUnhealthy = accounts.some((a) => a.dead || a.healthy === false)
  const allDead = accounts.length > 0 && accounts.every((a) => a.dead)
  const pipedreamLastActivity = latestPipedreamActivityIso(accounts)

  const { primary: primaryAccount } = useMemo(() => {
    if (accounts.length === 0) return { primary: null as PdAccount | null, duplicateRows: 0 }
    return pickPrimaryAccount(accounts)
  }, [accounts])

  const statusBusy =
    connecting || syncingAfterConnect || (Boolean(isFetching) && !connected && !isLoading)

  const runPostConnectSync = useCallback(async () => {
    setSyncingAfterConnect(true)
    try {
      const ok = await syncAccountsAfterConnect(queryClient, () => refetch())
      if (ok) {
        toast({ title: `${app.name} linked`, description: "Connection is up to date." })
      } else {
        toast({
          title: "Connected — status may lag",
          description: "Pipedream saved the link. Reload if the banner still shows not connected.",
        })
      }
    } finally {
      setSyncingAfterConnect(false)
    }
  }, [queryClient, refetch, toast, app.name])

  const connect = async () => {
    setConnecting(true)
    try {
      await client.connectAccount({
        app: app.slug,
        onSuccess: () => {
          toast({ title: `${app.name} authorized`, description: "Finishing up…" })
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

  return (
    <Card className="glass-card border-border flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0" aria-hidden="true">{app.logo}</div>
            <div>
              <CardTitle className="text-base text-foreground">{app.name}</CardTitle>
              <span className="text-[11px] text-muted-foreground">{app.category}</span>
            </div>
          </div>
          {connected && !allDead && (
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-[10px] shrink-0">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
              Connected
            </Badge>
          )}
          {(allDead || (!connected && isFetched && !statusBusy)) && !isLoading && (
            <Badge variant="outline" className={cn("text-[10px] shrink-0", allDead ? "text-destructive border-destructive/30" : "text-muted-foreground")}>
              {allDead ? "Expired" : "Not connected"}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {app.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 mt-auto space-y-3">
        {/* Status line */}
        {connected && !isLoading && primaryAccount && (
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground truncate">
                {primaryAccount.name ? `@${primaryAccount.name}` : `Account …${primaryAccount.id.slice(-6)}`}
              </span>
              <AccountHealthBadge account={primaryAccount} />
            </div>
            {pipedreamLastActivity && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3 shrink-0" />
                Last active: {formatDate(pipedreamLastActivity)}
              </p>
            )}
          </div>
        )}

        {!connected && !isLoading && statusBusy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            {connecting ? "Complete sign-in in the Pipedream window…" : "Syncing…"}
          </div>
        )}

        {accountsError && (
          <p className="text-xs text-destructive">
            {accountsError instanceof Error ? accountsError.message : "Failed to load"}
          </p>
        )}

        {/* Connect button */}
        <Button
          type="button"
          size="sm"
          onClick={() => void connect()}
          disabled={connecting || syncingAfterConnect || isLoading}
          variant={connected && !allDead && !hasUnhealthy ? "outline" : "default"}
          className="w-full gap-2 h-8 text-xs"
        >
          {connecting || syncingAfterConnect ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plug className="h-3.5 w-3.5" />
          )}
          {isLoading
            ? "Loading…"
            : connected && !allDead
              ? hasUnhealthy
                ? "Reconnect"
                : "Reconnect"
              : `Connect ${app.name}`}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── GitHub card (enhanced — repos, live verify) ──────────────────────────────

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

  const {
    data: accounts = [],
    isLoading,
    refetch,
    isFetching,
    isFetched,
    error: accountsError,
  } = useQuery<PdAccount[]>({
    queryKey: ["pipedream-accounts", userId, "github"],
    queryFn: async () => {
      const res = await fetch("/api/pipedream/accounts?app=github")
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

  const connected = accounts.length > 0
  const hasUnhealthy = accounts.some((a) => a.dead || a.healthy === false)
  const allDead = accounts.length > 0 && accounts.every((a) => a.dead)
  const pipedreamLastActivity = latestPipedreamActivityIso(accounts)

  const { primary: primaryAccount, duplicateRows } = useMemo(() => {
    if (accounts.length === 0) return { primary: null as PdAccount | null, duplicateRows: 0 }
    return pickPrimaryAccount(accounts)
  }, [accounts])

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

  const runPostConnectSync = useCallback(async () => {
    setSyncingAfterConnect(true)
    try {
      const ok = await syncAccountsAfterConnect(queryClient, () => refetch())
      if (ok) {
        toast({ title: "GitHub linked", description: "Connection is up to date." })
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
        {/* Status banner */}
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
              {allDead || hasUnhealthy ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              {allDead
                ? "GitHub link on file — token(s) expired. Reconnect below."
                : hasUnhealthy
                  ? "Connection needs attention — reconnect below to refresh OAuth."
                  : primaryAccount?.name
                    ? `Connected as @${primaryAccount.name}.`
                    : "GitHub connected for this workspace."}
              {duplicateRows > 0 && !allDead && (
                <span className="block mt-1 text-xs font-normal text-muted-foreground">
                  {duplicateRows} duplicate Pipedream connection{duplicateRows === 1 ? "" : "s"} hidden — showing the
                  latest only.
                </span>
              )}
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

        {/* Account detail card */}
        {connected && !isLoading && primaryAccount && (
          <div className="space-y-2">
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  {primaryAccount.name ? `@${primaryAccount.name}` : `Account ${primaryAccount.id.slice(0, 8)}…`}
                </span>
                <AccountHealthBadge account={primaryAccount} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {primaryAccount.updatedAt && (
                  <div>Last updated (Pipedream): {formatDate(primaryAccount.updatedAt)}</div>
                )}
                {primaryAccount.lastRefreshedAt && (
                  <div>Credentials last refreshed: {formatDate(primaryAccount.lastRefreshedAt)}</div>
                )}
                {primaryAccount.expiresAt && (
                  <div>Access refresh by: {formatDate(primaryAccount.expiresAt)}</div>
                )}
                {primaryAccount.error && (
                  <div className="text-destructive">Pipedream: {primaryAccount.error}</div>
                )}
              </div>
            </div>
            {pipedreamLastActivity && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                Latest activity:{" "}
                <span className="font-medium text-foreground">{formatDate(pipedreamLastActivity)}</span>
              </p>
            )}

            <div className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Live verification (GitHub API)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Confirms this app can call GitHub on your behalf right now — stronger than "Pipedream has a row on
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
                {verifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
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

        {/* Repos section */}
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

        {/* Actions */}
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
    <div className="flex flex-col gap-8 max-w-5xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your accounts. Juno uses these connections to act on your behalf across tools and workflows.
        </p>
      </div>

      {pipedreamReady && pdClient ? (
        <QueryClientProvider client={queryClient}>
          <FrontendClientProvider client={pdClient}>
            {/* GitHub — featured card with extra capabilities */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Featured</h2>
              </div>
              <GithubPipedreamCard userId={userId} />
            </section>

            {/* All other apps */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Connect more apps</h2>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                All connections use Pipedream&apos;s hosted OAuth — you can revoke access from Pipedream project settings at any time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {APPS.map((app) => (
                  <AppConnectCard key={app.slug} userId={userId} app={app} />
                ))}
              </div>
            </section>
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

      {/* Obsidian vault — separate from Connect */}
      <div className="space-y-2 pt-2 border-t border-border">
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
