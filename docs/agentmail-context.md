# AgentMail — Juno Context

*Fully researched brief for agents and team members. Compiled from: agentmail.to (all pages + full blog), GlobeNewswire press release, TechCrunch, The Next Web, The AI Insider, eesel AI review, YC company page, LinkedIn. Last updated April 2026.*

---

## What They Are Building

AgentMail is the **first email provider built for AI agents** — infrastructure that gives autonomous AI agents their own real, functional email addresses and inboxes, accessed entirely via API.

The core insight: email is the identity layer of the internet. Every meaningful service — banks, SaaS tools, government portals, vendors, suppliers — uses email to verify identity, communicate, and transact. For a human, a Gmail address unlocks the entire internet. For an AI agent, nothing equivalent existed. Until AgentMail.

Human email providers (Gmail, Outlook) were designed for people — OAuth flows, browser interfaces, per-user pricing, daily send caps, rate limits that assume one human typing one email at a time. None of that works for agents operating at scale, around the clock, across hundreds of thousands of inboxes simultaneously.

AgentMail is built from scratch for agents as first-class users — not bolted onto infrastructure designed for humans.

**Tagline:** *"It's not AI for your email. It's email for your AI."*

**Core belief:** *"The next billion users of the internet will be AI agents. We're building infrastructure that treats agents as first-class citizens, starting with email."* — Haakam Aujla, CEO

**YC batch:** S25 (Summer 2025)
**Founded:** 2025
**HQ:** San Francisco, CA
**Live since:** August 2025

---

## The Problem

Three things agents need from email that human providers cannot deliver:

**1. Identity at scale**
Every AI agent needs a real, verifiable identity to interact with the internet — to sign up for services, receive 2FA codes, exchange contracts, coordinate with vendors. Email is the universal identity layer. Gmail imposes per-inbox costs and manual setup. There is no programmatic way to spin up 10,000 agent inboxes in Gmail. AgentMail does it in one API call.

**2. Two-way communication, not just sending**
Transactional email APIs (SendGrid, Mailgun, AWS SES) are send-only. They have no concept of receiving, threading, replying, parsing, or searching a conversation. Real agent work — vendor negotiation, customer support, loan collection, procurement coordination — requires a full inbox, not a one-way pipe. When Gmail bans an agent for unusual activity (which it does), the entire workflow breaks. AgentMail is built for exactly this.

**3. Agent-native infrastructure**
Human email providers impose daily send limits (500–2,000/day), require OAuth flows that agents can't navigate, have no webhook-first design, and weren't architected for the pattern of thousands of agents, each handling high volumes of inbound messages simultaneously. The misfit is fundamental — not a missing feature, a wrong foundation.

**The OpenClaw moment (late January 2026):**
When OpenClaw went viral — gaining 34,168 GitHub stars in 48 hours and becoming one of the fastest-growing open-source projects in GitHub history — it created an immediate, massive demand for agent infrastructure. Developers everywhere suddenly had agents that needed to do things on the internet, and email was the first bottleneck. AgentMail's user base tripled in OpenClaw's breakout week and quadrupled the following month. The viral growth validated the thesis in the most concrete way possible: the demand for agent email infrastructure was already there, waiting for a trigger.

---

## Product: Full Detail

### Core Infrastructure

**Programmatic Inbox Creation**
One API call. An inbox with a real email address, live in milliseconds. No manual setup, no web UI, no OAuth dance. Scales from 1 inbox to 25,000+ (one customer's current deployment).

**Full Two-Way Email**
Not send-only. Agents can:
- Send emails and receive replies in the same thread
- Thread and manage conversations
- Label and organise inboxes with custom prompts
- Search semantically across all inboxes
- Parse incoming emails into structured JSON automatically
- Reply, forward, and manage drafts programmatically

**Real-Time Event Delivery**
Webhooks and WebSockets for instant notification on inbound messages — no polling required. Critical for responsive agent workflows where a reply might trigger the next action.

**Authentication**
Simple API keys. No OAuth. No browser. No human in the loop for setup or ongoing auth.

**Custom Domains**
DKIM, SPF, and DMARC configured automatically. Custom domain support on Developer tier and above. Dedicated IPs on Startup tier for deliverability control.

**Email Security**
Built-in spam filtering, malware scanning, bounce rate monitoring. SOC 2 Type II certified. TLS 1.2+ encryption in transit and at rest. Per-customer isolation.

---

### AI-Specific Features

**Email as Memory**
AgentMail's blog framing (February 2026): email inboxes function as three types of agent memory:
- *Semantic memory* — searchable knowledge base of past communications
- *Episodic memory* — chronological record of what happened with whom and when
- *Procedural memory* — templates and patterns from past successful interactions

Agents can search their own inbox history to inform current decisions — a capability no transactional email API provides.

**Email as Identity**
Each inbox gives an agent a verifiable, persistent identity it can use to:
- Sign up for any internet service
- Receive and act on 2FA codes autonomously
- Establish a sender reputation over time
- Participate in any email-based workflow that already exists

**Structured Data Extraction**
Incoming emails automatically parsed into structured JSON — invoice numbers, amounts, dates, names, action items — without custom parsing code.

**Automatic Labelling**
Custom prompts define labelling rules. Agents can categorise inbound email automatically without manual configuration per inbox.

**Agent Guardrails**
- Unverified agents capped at 10 outbound emails per day
- Rate limiting on unusual activity patterns
- Bounce rate monitoring
- Account sampling for sensitive keywords
- Abuse safeguards on the self-onboarding API

---

### Agent Self-Onboarding (agent.email)

One of the most telling product signals: AgentMail launched `agent.email` — a landing page and API that lets an AI agent sign itself up for AgentMail autonomously. Agents discovered AgentMail through web search, navigated to the site, and created their own inboxes without a developer in the loop. This wasn't a planned feature — it was observed behaviour that the team then productised.

It validated the thesis at the infrastructure level: agents are already acting as internet users. They need services designed for them.

---

### SDKs & Integrations

**Official SDKs:** Python, TypeScript/Node.js, Go, CLI

**Framework integrations:**
- LangChain
- LlamaIndex
- CrewAI
- LiveKit (voice agents — send email follow-ups after a voice call)
- Google ADK
- Mastra
- Replit (April 2026 — Replit apps can now send and receive email via AgentMail)
- Sim Studio
- Hermes
- Browser Use (cloud browser sessions receive signups, OTPs, and verification links)
- Model Context Protocol (MCP) server

**Infrastructure compatibility:** IMAP & SMTP support for legacy system integration.

**Pods (Multi-tenant)**
For platform builders who want to give each of their customers their own agents with dedicated inboxes — white-labelled infrastructure at the platform level.

---

### Pricing

| Plan | Cost | Inboxes | Monthly Emails | Storage | Notable |
|---|---|---|---|---|---|
| **Free** | $0 | 3 | 3,000 | 3 GB | No credit card |
| **Developer** | $20/mo | 10 | 10,000 | 10 GB | Custom domains |
| **Startup** | $200/mo | 150 | 150,000 | 150 GB | Dedicated IPs, Slack support, SOC 2 reports |
| **Enterprise** | Custom | Custom | Custom | Custom | White-labelling, EU hosting, SSO |

Free tier: 100 emails/day limit. All paid tiers include API access, webhooks, and email support.

---

## Scale & Traction

| Metric | Figure |
|---|---|
| Launch | August 2025 |
| Emails delivered | 100M+ |
| Human users | Tens of thousands |
| Agent users | Hundreds of thousands |
| B2B customers | 500+ |
| Largest single customer | 25,000 inboxes provisioned |
| Growth trigger | 3x week of OpenClaw going viral (Jan 2026), 4x the following month |

---

## Founding Team

**Haakam Aujla — CEO & Co-founder**
University of Michigan. Former quantitative researcher at Optiver (one of the world's top high-frequency trading firms). Brings systematic, infrastructure-first thinking to a category that most founders approach from the application layer. His framing: agents are already the next billion internet users — the infrastructure needs to catch up.

**Michael (Hyun) Kim — Co-founder**
University of Michigan. Previously at NVIDIA working on autonomous vehicles. Deep engineering background in systems where autonomous agents must operate reliably at scale in the real world — exactly the reliability profile AgentMail's infrastructure requires.

**Adi Singh — Co-founder**
University of Michigan. Previously an investor at Accel, StepStone Group, and Flex Capital. Brings the investor-side view of what enterprise infrastructure companies need to look like to scale — and the network from Accel that directly opened early enterprise relationships.

All three met at Michigan. The combination of quant systems thinking (Aujla), autonomous systems engineering (Kim), and infrastructure venture investing (Singh) is a precise fit for building critical internet infrastructure for the agent era.

---

## Investors & Funding

**Round:** $6M Seed
**Date:** March 10, 2026
**Lead:** General Catalyst

| Investor | Type | Context |
|---|---|---|
| General Catalyst (Yuri Sagalov) | Lead | Major enterprise infrastructure backer; Yuri Sagalov led the deal |
| Y Combinator | Institutional | S25 batch |
| Phosphor Capital | Co-investor | — |
| Paul Graham | Angel | YC co-founder; rare personal angel investment |
| Dharmesh Shah | Angel | CTO, HubSpot — deep enterprise SaaS context |
| Paul Copplestone | Angel | CEO, Supabase — infrastructure-as-a-service builder |
| Karim Atiyeh | Angel | CTO, Ramp — high-volume, programmatic financial operations |
| Taro Fukuyama | Angel | — |

**Investor quotes:**

- Yuri Sagalov (General Catalyst): *"AI agents are already functioning as virtual employees. Email is the heart of identity on the internet. Traditional identity services were not built with agentic use cases in mind. AgentMail is building that infrastructure — the team's clarity and execution impressed us immediately."*

The angel list is a signal in itself: the CTO of HubSpot (email/CRM), the CEO of Supabase (developer infrastructure), and the CTO of Ramp (programmatic finance at scale) are all personally backing an email infrastructure company for agents. These are people who understand exactly what it means to build API-first infrastructure at enterprise scale.

---

## Customers & Use Cases

**Named customer:**
- **DoAnything (Garret Scott, CEO):** *"AgentMail took email from the thing I worried about most to something I barely think about. Now thousands of DoAnything agents operate autonomously with their own identities."*

**Production use cases across the customer base:**
- **Supply chain coordination** — agents emailing multiple carriers, suppliers, and logistics partners simultaneously to track, reroute, and confirm shipments
- **Loan collection and payment reminders** — agents sending, receiving, and threading follow-up communications with borrowers
- **Autonomous customer support** — agents triaging, categorising, and responding to support tickets via email
- **Vendor procurement negotiation** — agents managing the back-and-forth of procurement conversations with multiple vendors
- **Browser automation** — agents signing up for services and extracting 2FA codes for downstream actions
- **Voice agent follow-up** — voice agents sending email documentation, summaries, and follow-up actions after a call (LiveKit integration)
- **Executive assistance** — calendar management, meeting confirmations, document routing
- **Invoice and document processing** — automated parsing and routing of incoming financial documents
- **Agent-to-agent communication** — agents in multi-agent systems coordinating with each other via email threads
- **QA testing** — disposable inboxes for testing signup and verification flows at scale

---

## Competitive Landscape

### Why Existing Tools Fail for Agents

| Tool | Failure Mode for Agents |
|---|---|
| **Gmail** | Manual setup, OAuth required, 500–2,000/day send cap, bans agents for unusual activity, per-user pricing doesn't scale |
| **SendGrid / AWS SES / Mailgun** | Send-only — no receiving, threading, searching, or replying. Transactional email, not inbox infrastructure |
| **Outlook / Microsoft 365** | Same problems as Gmail — human-first, OAuth-gated, rate-limited, not programmatic |
| **Postmark / Resend** | Transactional send APIs. No inbox. No two-way. No agent identity |

### Direct Positioning

There is no direct competitor that has built what AgentMail has built. The category is new. The nearest framing is "SendGrid, but for receiving as well as sending, and at agent scale" — but even that undersells it because AgentMail adds the identity layer, the memory layer, and the self-onboarding API that no transactional email product has contemplated.

**Where the risk lies:**
- Gmail or Microsoft could add programmatic inbox creation and agent-friendly rate limits — they have the distribution
- AWS SES could extend into two-way inbox infrastructure — they have the scale
- Resend or Postmark could build receiving/threading on top of their existing developer-beloved send APIs
- Spam and abuse potential is real — agents sending at scale creates deliverability risk for the entire platform if guardrails slip
- As the agent ecosystem matures, a new identity primitive (not email) could emerge and commoditise the email-as-identity thesis

---

## Business Model

**API-first SaaS — usage-based tiering:**

Revenue comes from:
1. **Subscription tiers** — Developer ($20/mo), Startup ($200/mo), Enterprise (custom) based on inbox count and email volume
2. **Enterprise contracts** — Custom SLAs, white-labelling, EU hosting, SSO, dedicated account management
3. **Pods** — Multi-tenant infrastructure for platform builders embedding AgentMail into their own products

**Defensible moat logic:** Agents build up email history, sender reputation, threaded conversation context, and integration configurations inside AgentMail. The longer an agent operates, the more valuable its inbox history becomes as memory. Switching means losing that history and resetting sender reputation — high switching costs built over time.

The platform fee model also means that as agents scale (more inboxes, more emails), revenue scales with them. A single enterprise customer provisioning 25,000 inboxes is a fundamentally different revenue profile than a 25,000-seat SaaS business.

---

## Strategic Priorities

Based on product trajectory through April 2026:

1. **Integrations velocity** — New framework integration announced almost weekly (Replit, Google ADK, Sim Studio, Hermes, Browser Use, Mastra — all April 2026). Every framework integration is a new distribution channel where developers discover AgentMail while building.

2. **Agent self-onboarding** — The `agent.email` autonomous signup flow is both a product and a thesis validation. Productising it signals the team is building for a world where agents are the customers, not just the use case.

3. **Email as identity → broader agent identity** — The blog post "Email as Identity for AI Agents" (March 2026) and the founders' stated roadmap make clear that email is the starting point, not the destination. Agent credentials, reputation systems, and trust mechanisms are the next layer — email provides the verifiable foundation to build on.

4. **Enterprise expansion** — 500+ B2B customers at seed stage. The Startup ($200/mo) and Enterprise tiers are where revenue concentrates. The GTM is bottom-up (developer adoption → team → company), the same model Stripe and Twilio used.

5. **Safety and deliverability infrastructure** — At 100M+ emails delivered, deliverability reputation is a core asset. Every blog post about email deliverability, spam prevention, and safe rendering is also a product investment protecting the platform's ability to land in inboxes at scale.

---

## The Bigger Vision: Agent Identity Infrastructure

AgentMail's stated long-term vision goes beyond email. The founders see email as the first and most universal identity layer — but not the last. Their roadmap extends toward:

- **Agent credentials** — verifiable, portable identity for agents across services
- **Reputation systems** — track records that agents build over time, portable across platforms
- **Trust mechanisms** — enabling agents to participate in internet-based commerce with verifiable history

The framing: just as the internet needed DNS, TLS, and OAuth to enable secure human identity, the agent internet needs its own identity stack. AgentMail is starting with the layer that already exists and already works — email — and building outward.

*"Email as Identity for AI Agents"* and *"Email as Memory for AI Agents"* (both published March/February 2026) are the intellectual foundation posts that signal where the product roadmap goes next.

---

## Note: AgentMail in This Codebase

AgentMail is already integrated into Juno's own infrastructure. Files:
- `app/api/webhooks/agentmail/route.ts` — inbound webhook handler
- `lib/juno/email-sender.ts` — outbound send operations
- `scripts/create-agentmail-webhook.cjs` — webhook setup
- `scripts/push-agentmail-webhook-secret-to-vercel.cjs` — deployment config

Juno uses AgentMail for its own agent email workflows — making this both a client context and a live dependency.

---

## Voice & Communication

**On-brand language:**
- *"It's not AI for your email. It's email for your AI."* — the clearest one-liner
- "First-class citizens" — agents deserve infrastructure built for them, not adapted from humans
- "The next billion users of the internet will be AI agents"
- "Email as identity" — the foundational thesis
- "Email as memory" — the agent-specific value layer
- "Programmatic" — the key word separating AgentMail from human-first providers
- "Two-way" — the core product differentiator from send-only APIs
- "Agent-native" — not adapted, purpose-built

**Off-brand language:**
- "AI-powered email" — implies AI applied to email, not email built for AI
- "Email automation" — sounds like marketing drip sequences, not infrastructure
- "Smart inbox" — consumer product framing
- "Copilot" — human-assistance framing, wrong direction
- Anything that positions AgentMail as a tool to help humans manage email

**One sentence:** AgentMail is the first email provider built for AI agents — programmatic inboxes with real addresses, two-way communication, threading, and semantic search, all via API, so agents can operate as first-class citizens on the internet.

---

## Keywords & Signals to Monitor

AgentMail, agentmail.to, Haakam Aujla, Michael Kim Adi Singh AgentMail, AI agent email infrastructure, email for AI agents, agent email API, programmatic email inbox, agent identity infrastructure, email as agent identity, AI agent inbox, General Catalyst AI infrastructure, YC S25 email, OpenClaw email infrastructure, agent-native email, DoAnything AI agents, LangChain email integration, LlamaIndex email, CrewAI email, MCP email server, agent self-onboarding email, agent internet citizens, email as AI memory, two-way email API, transactional email vs agent email, Gmail alternative AI agents, Resend alternative agents, SendGrid alternative agents

---

## Load Into Juno (AgentMail Workspace)

1. In the sidebar, select the **AgentMail** workspace so saves hit the correct `client_workspace_profiles` row.
2. **Knowledge Base Document:** paste this full markdown file into the textarea, then **Save**.
3. Refresh — Juno should reflect AgentMail context across all responses for that workspace.

If any previous company profile persists, use **Erase saved document**, re-paste this file, and **Save** again.
