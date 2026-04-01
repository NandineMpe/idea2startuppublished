# GTM Motion pipeline (spec)

End-to-end flow from qualified leads to drafted cold emails, optional AgentMail send, and webhook updates.

## Environment

- `THEORG_API_KEY` — TheOrg Company / Chart / Position APIs (`lib/juno/theorg.ts`).
- `ANTHROPIC_API_KEY` — Research + drafting (`lib/juno/gtm-outreach.ts`).
- `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID` — Preferred outbound mail + AgentMail inbox identity (`lib/juno/email-sender.ts`).
- `AGENTMAIL_WEBHOOK_SECRET` — Svix verification for `app/api/webhooks/agentmail/route.ts`.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — Legacy fallback sender.
- `RESEND_WEBHOOK_SECRET` — Legacy Resend webhook verification for older deployments.

## Inngest

- **Event:** `juno/lead.qualified` with `LeadQualifiedPayload` (`lib/juno/types.ts`).
- **Function:** `gtmMotion` in `lib/inngest/functions/gtm-motion.ts` (registered via `lib/inngest/functions/index.ts` and `app/api/inngest/route.ts`).
- **Steps:** `lookup-org-chart` → `research-company` → `identify-contacts` → `enrich-contacts` → `load-context` → `draft-emails` → `save-drafts` → `update-lead`.
- **Emit:** CRO job pipeline (`lib/inngest/functions/cro/job-pipeline.ts`) and lead import (`app/api/leads/import/route.ts`) when ICP score ≥ 7.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/outreach` | Queue; default `status=drafted`. Use `?status=all` for full history. |
| POST | `/api/outreach/[id]` | `{ "action": "send" }` — outbound provider send + row update. |
| POST | `/api/outreach/send` | Legacy alias: `{ "id": "uuid" }`. |
| PATCH | `/api/outreach/[id]` | Edit subject/body, skip, schedule, lookalike sync, mark sent manually. |
| POST | `/api/webhooks/agentmail` | AgentMail events → `outreach_log` (sent, delivered, bounced, complained, replied). |
| POST | `/api/webhooks/resend` | Resend events → `outreach_log` (opens, clicks, bounces, complaints). |

## UI

- **Component:** `components/dashboard/gtm-motion-panel.tsx` (GTM / Distribution tab).
- **Actions:** Edit (PATCH), Send (POST `action: send`), Skip (PATCH `status: skipped`), Copy, Mark sent, Lookalike outcome sync.
- **Badges:** drafted (gray), sent (blue), opened/clicked (green), replied (purple), bounced/complained (red), skipped (neutral).

## Data

- **`outreach_log`** — Drafts and sends (`supabase/migrations/025_outreach_gtm.sql`).
- **`cro_leads.account_intel`** — Org chart + research snapshot after pipeline run.
