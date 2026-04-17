# Dedalus Labs — Juno Context

*Fully researched brief for agents and team members. Compiled from: dedaluslabs.ai (all pages + blog), Kindred Ventures announcement, Saga Ventures, Access Fund, YC company page, FounderTrace, TAMradar, Crunchbase, LinkedIn. Last updated April 2026.*

---

## What They Are Building

Dedalus Labs is the **infrastructure layer for AI agents** — a single platform where developers build, deploy, and monetise production-grade AI agents in minutes, not weeks.

The simplest way to understand it: developers currently spend most of their time fighting infrastructure — wiring up AWS configs, managing credentials across systems, stitching together multiple SDKs, handling model provider lock-in, and maintaining glue code that breaks constantly. Dedalus eliminates all of that. You write five lines of code. You deploy in one click. Your agent is live.

Positioned by investors and press as **"the Vercel for AI agents."**

**Core taglines:**
- *"Build, Deploy & Monetize AI Agents"*
- *"One SDK. Any model. Any tool. Ship in minutes."*
- *"Cloud infrastructure for long-running AI agents."*
- *"Persistent VMs that sleep for free and wake in milliseconds."*
- *"99% of the most useful agents have not been built yet."* — Cathy Di, CEO

**YC batch:** S25 (Summer 2025)
**HQ:** San Francisco, CA

---

## The Problem

Building and deploying AI agents is far harder than it should be. Three compounding problems:

**1. Infrastructure complexity kills momentum**
Every developer building an agent hits the same wall — hours or days lost fighting AWS and GCP configs, Dockerfiles, YAML, networking, credential management, and model provider wiring. A task that should take minutes takes a week. Most teams write 200+ lines of infrastructure code before they've written a single line of actual agent logic.

**2. The tooling is fragmented and brittle**
Current agent frameworks force developers to pick one model provider and build around it. Real production agents need to switch models dynamically — different tasks call for different models, and providers go down. Traditional workflow automation is either rigid drag-and-drop (unsuitable for developers) or vendor-locked. There's no standardised way to connect agents to external tools at scale.

**3. MCP is the new API layer — and deploying MCP servers is too hard**
Anthropic's Model Context Protocol (MCP) is becoming the standard interface between AI models and external tools — what HTTP was for the web. As agents become the primary users of software (alongside humans), every service needs to expose itself as an MCP server. But deploying and managing MCP servers currently requires Docker, complex configuration, and dedicated DevOps time. Dedalus makes it three clicks.

Cathy Di's framing: *"We were tired of settling for tools that didn't match how agents interact with the real world."*

---

## Product: Full Detail

### The Four-Layer Stack

**1. Agent SDK (Open Source)**
Python and TypeScript. Builds production-grade, tool-calling agents in approximately five lines of code — down from 200+ lines with traditional approaches. Key capabilities:
- Vendor-agnostic model handoffs — switch between OpenAI, Anthropic (Claude), Google (Gemini), Groq, and Fireworks within a single agent, dynamically, mid-execution
- Seamless tool chaining between local functions and hosted MCP servers
- Streaming preserved across all model and tool transitions
- Non-linear, non-deterministic workflows — agents that adapt dynamically without hardcoded control flows
- Open-source core with commercial infrastructure layer on top

**2. Unified API Gateway**
One OpenAI-compatible API endpoint that routes to any model provider. Developers switch between providers by changing a single parameter — no code rewrites, no re-integration. Supported providers: OpenAI, Anthropic, Google, Groq, Fireworks. Automatic failover. Per-session and per-task model switching.

**3. Agents-as-a-Service (AaaS) — Hosted Infrastructure**
Deploy agents as callable endpoints with zero DevOps:
- One-click deployment
- Real-time monitoring dashboard
- Automatic hardware failure recovery
- No session limits, no garbage collection
- Self-healing on host maintenance — zero downtime live migration

**Dedalus Machines (underlying compute):**
Full Linux microVMs built on the custom Dedalus Hypervisor (Cloud Hypervisor-based):
- **50ms boot time** via snapshot restore — 260x faster than traditional image pulls
- **Hardware-enforced VM-level isolation** — privilege ring transitions and Extended Page Tables (EPT), not containers
- **Persistent storage** — 100% POSIX compliant (pjdfstest verified)
- **Scale-to-zero billing** — $0 cost during sleep states, per-second billing when active
- GPU/CUDA support for ML workloads
- Nested virtualisation
- Full root access, any package manager, any runtime, any binary
- Disaggregated compute and storage architecture
- Live VM migration with zero downtime

**4. MCP Marketplace**
A community marketplace for discovering, deploying, and monetising MCP servers (tools). Key features:
- 130+ hosted MCP servers from the developer community (at seed announcement)
- Deploy any tool with a single slug — no Docker, no config
- **Creators keep 80% of revenue** from tool sales — sustainable creator economy for the agent era
- External URL support for connecting MCP servers deployed elsewhere
- Model Context Protocol native throughout

### DAuth (Dedalus Auth)
Industry-grade authentication for MCP — open-sourced:
- **"Your secrets never leave your machine"** — credentials decrypted only inside sealed execution boundaries
- Multi-tenant authentication preventing agents from handling unencrypted credentials
- Implements OAuth 2.1, DPoP (Demonstrating Proof-of-Possession), and TEE (Trusted Execution Environment) isolation
- Remote servers use local credentials without ever seeing them
- NIST-aligned audit trails

### Confirmed Use Cases (Production)
- Employee and customer onboarding workflows (Eragon customer, Dedalus case)
- CRM agents that search Twitter/X for high-value leads and warm intros
- Finance research agents integrating market data and web search
- CI/CD pipeline automation
- Code generation and agent sandboxing
- ML training workloads
- Web scraping at scale
- PDF generation pipelines
- Long-running autonomous systems (persistent state, no garbage collection)

---

## Pricing

| Tier | Monthly | Included | Per Tool Call (overage) |
|---|---|---|---|
| **Hobby** | Free | 50 tool calls/month | $0.0050 |
| **Pro** | $20 (includes $20 credit) | 1,000 free calls, BYOK, external MCP URLs | $0.0025 |
| **Enterprise** | Custom | Audit logs, RBAC, 90-day retention, priority support | Custom |

**Managed Runners:** $0.0001/CPU-second + $0.0004/GB-second
**Platform fee:** 5% on balance reloads

**Example (Dedalus Machines):** 4 vCPU, 8GB RAM, 50GB storage, 200 active hours + 544 idle hours = $63.62/month — 64% less than comparable competitors.

**Active compute:** $0.12/hour. **Idle compute:** $0.00/hour.

**Free tier entry:** 50 hours/month, no credit card required.
**YC companies:** $200 free credits offered at launch.

---

## Founding Team

**Catherine (Cathy) Di — CEO & Co-founder**
Princeton University CS. Previously: Product Manager at Voyage AI (acquired by MongoDB), and Salesforce. Brings product intuition for developer tools and distributed agent architectures. Her public thesis: *"99% of the most useful agents have not been built yet"* — the bottleneck is not capability but the imagination and infrastructure gap between what's possible and what developers can actually ship. On X as @itsCathyDi.

**Windsor Nguyen — CTO & Co-founder**
Princeton University CS senior. Previously: DeepMind, Sentient AGI (where the team first encountered the MCP deployment problem). DMA (Distributed ML Architecture) contributor. Leads distributed machine learning systems and the streaming handoff architecture. On X as @WindsorNguyen.

The founders met the core problem firsthand: while experimenting with AI agents, they kept hitting the same bottleneck — everyone was spending hours fighting AWS and GCP configs before writing a single line of agent logic. They built Dedalus to solve their own problem.

**Extended team (10 people total):**
Aaron Bisla, Aryan Mahajan, Shuyao Zhou, Tsion Kergo, Alex DeNuzzo, Manna Patiparnprechavut, Xinyan He, Shengming Liang — engineers and builders.

---

## Investors & Funding

**Round:** $11M Seed
**Date:** October 15, 2025
**YC Batch:** S25

| Investor | Type | Notable Context |
|---|---|---|
| Kindred Ventures (Steve Jang) | Lead | Also backed Corgi, Twitch, Lyft |
| Saga Ventures (Max Altman, Ben Braverman, Thomson Nguyen) | Co-lead | Max Altman is Sam Altman's brother |
| Emergence Capital | Institutional | Enterprise software specialist |
| E14 Fund (MIT) | Institutional | MIT's entrepreneurship fund |
| Liquid 2 Ventures | Institutional | Joe Montana's fund |
| Sunshine Lake | Institutional | — |
| Transpose Platform | Institutional | — |
| FPV Ventures | Institutional | — |
| Twenty Two Ventures | Institutional | — |
| Telescope Foundation | Institutional | — |
| Spot VC | Institutional | — |
| Operator Partners | Institutional | — |
| Y Combinator | Accelerator | S25 batch |
| Thomas Wolf | Angel | Co-founder & CSO, Hugging Face |
| Cal Henderson | Angel | Co-founder & CTO, Slack |
| Ant Wilson | Angel | Co-founder & CTO, Supabase |
| Thomas Dohmke | Angel | Former CEO, GitHub |
| Tri Dao | Angel | Creator of FlashAttention; Chief Scientist, Together AI |
| Elad Hazan | Angel | Creator of AdaGrad; Google DeepMind & Princeton |
| OpenAI angels | Angel | Unnamed, per Kindred announcement |

**Program backers (Break In hacker house):** J.P. Morgan, Emergence Capital, Draper Associates.

The angel list is a direct signal of credibility within the ML infrastructure and developer tools community — the creators of FlashAttention, AdaGrad, Hugging Face, Slack, Supabase, and GitHub are personally backing the company.

---

## Customers & Traction

**Production partners named at seed announcement:**
- **Eragon** — AI OS for enterprise (Josh Sirota, CEO). Using Dedalus for MCP orchestration and agent deployment
- **Nara** — Validating the model-agnostic orchestration approach
- Unnamed YC startups using the $200 free credit offer

**Integration partners confirmed:**
Scorecard, Mem0, Northflank, Supabase, Fal (generative media)

**Platform metrics (at seed, October 2025):**
- 130+ hosted MCP servers in marketplace from early developer community
- Open-source SDK available via pip install

Detailed ARR/revenue figures not publicly disclosed. Focus at this stage is developer adoption velocity and ecosystem growth.

---

## Competitive Landscape

### Direct Competitors (Agent Infrastructure / Sandboxes)

**E2B**
The current market leader in agent sandboxing. 200M+ sandboxes started, Fortune 100 adoption. Uses Firecracker microVMs (same base as AWS Lambda). Built for ephemeral code execution — strong on cold starts, weaker on persistent state for long-running agents. Dedalus's counter: E2B sandboxes are ephemeral; Dedalus VMs persist state indefinitely with $0 idle cost. E2B has no MCP marketplace or monetisation layer.

**Daytona**
Pivoted from dev environments to AI agent infrastructure in early 2025. Raised $24M Series A (February 2026). Sub-90ms sandbox creation, some configs hitting 27ms. Strong on Computer Use agents (Windows/macOS/Linux desktops). Dedalus's counter: Daytona is compute only. Dedalus is a full stack — SDK, compute, API gateway, MCP marketplace, auth, and monetisation in one platform.

**Fly.io Sprites** (launched January 2026)
Firecracker microVMs, 100GB persistent NVMe, checkpoint/restore ~300ms. Growing fast on the developer community Fly.io already owns. Dedalus's counter: 50ms vs 300ms boot (6x faster). Dedalus has the full agent platform layer; Fly.io Sprites is compute only.

**Modal**
Deep GPU support for ML compute. Strong for training workloads. Dedalus's counter: Modal is infrastructure, not an agent platform. No MCP, no marketplace, no agent SDK.

**LangChain / LangGraph**
Popular agent orchestration frameworks. Open-source, heavy on configuration, complex to productionise. Dedalus's counter: framework, not infrastructure. Requires separate deployment, credential management, and hosting — all the problems Dedalus solves.

### Where Dedalus Wins
- **Full stack** — only platform combining SDK + compute + API gateway + MCP marketplace + auth in one place
- **50ms boot** — fastest persistent VM restore in the market (260x faster than image pulls, 6x faster than Sprites)
- **True persistence** — state survives across sleep cycles; no garbage collection; not ephemeral sandboxes
- **Scale-to-zero economics** — $0 when idle; 64% cheaper than comparable infra for long-running agents
- **MCP-native** — built around the standard that is winning (Anthropic's MCP vs proprietary tool frameworks)
- **Creator monetisation** — 80% revenue share turns the marketplace into a distribution flywheel
- **DAuth** — cryptographic credential isolation that no competitor has matched
- **Open-source SDK** — community trust and contribution that proprietary platforms can't replicate
- **Angel network** — the people who built the underlying tools (FlashAttention, AdaGrad, Hugging Face) are personally invested

### Where the Risk Sits
- E2B has a massive head start in market presence (200M+ sandboxes)
- Daytona raised a Series A 5 months after Dedalus's seed — more capital in the market
- AWS, Google Cloud, and Azure could absorb the microVM and MCP deployment problem natively into their platforms
- Developer tool adoption is community-driven and can be unpredictable; network effects take time to build
- 80% creator rev share is generous but requires marketplace volume to be meaningful

---

## Business Model

**Multi-sided platform:**

1. **Developer subscriptions** — Hobby (free), Pro ($20/month), Enterprise (custom) for platform access, compute, and API calls
2. **Compute usage** — Per-second billing on active microVMs; $0 idle
3. **MCP Marketplace** — 5% platform fee on marketplace transactions; creators keep 80%
4. **Enterprise contracts** — Custom SLAs, RBAC, audit logs, priority support for large deployments

**Strategic logic:** The marketplace creates a network effect. More tools → more useful the platform → more developers → more tool creators → more tools. Infrastructure that's hard to leave once your agent workflows, persistent VMs, and MCP tool configurations are embedded.

**Open-source core:** The SDK is open-source (community trust, contribution, viral adoption). Revenue is on the managed infrastructure layer above it — same model as Supabase, Vercel, and Fly.io.

---

## Strategic Priorities

Based on seed announcement (October 2025) and blog activity through March 2026:

1. **Grow the MCP marketplace** — 130+ servers at seed. The marketplace is the distribution flywheel. Every tool creator who joins brings their user base.
2. **DAuth open-source release** — Releasing production-grade MCP authentication as open-source to set the standard before competitors do. Standards-setting is a moat.
3. **Developer community growth** — "Break In" hacker house (SF, December 2025) for international founders; active Discord; YouTube tutorials; blog how-to guides
4. **Enterprise readiness** — Audit logs, RBAC, 90-day retention already in roadmap. Moving upmarket to land larger contracts
5. **A2A (Agent-to-Agent) infrastructure** — Cathy Di's March 2026 blog post "From Today to A2A: Crossing the Imagination Chasm" signals the next product direction: infrastructure where agents call other agents, not just humans calling agents

---

## Vision: The Imagination Chasm

*From Cathy Di's March 2026 blog post:*

*"99% of the most useful agents have not been built yet."*

The limitation is not the models. The limitation is that developers can't imagine — and then ship — agents fast enough. The gap between what's technically possible and what gets built is the "Imagination Chasm."

Dedalus's mission is to collapse that gap. Every week of glue code eliminated, every deployment reduced to one click, every credential management problem automated away — each makes it easier for a developer to ship the agent that should exist but doesn't yet.

The A2A vision (Agent-to-Agent): as agents become more capable, the infrastructure needed shifts from "humans calling agents" to "agents calling other agents." Dedalus is building for that world — where agents are first-class users of the platform, calling other agents through the MCP marketplace, orchestrating complex multi-agent systems without human coordination overhead.

---

## Community Initiatives

**Break In** — Three-week hacker house, SF (The Residency, Pacific Heights), December 2–22, 2025.
- Free housing, meals, and coworking space
- For international founders building AI startups who aren't yet in SF
- Build on Dedalus SDK or MCP infrastructure with team mentorship
- Introductions to top founders, mentors, and investors
- Priority access to major tech events, free API credits, partner infrastructure access
- Backed by J.P. Morgan, Emergence Capital, Draper Associates

---

## Voice & Communication

**On-brand language:**
- "Build, deploy, and monetise" — the full lifecycle, not just dev tools
- "5 lines of code" — specific, concrete, credible
- "One click" / "3 clicks" — radical simplicity
- "MCP-native" — standard-aligned, not proprietary
- "Persistent" — the key differentiator from ephemeral sandboxes
- "Scale to zero" — economic framing developers immediately understand
- "The Vercel for AI agents" — a useful analogy to explain the category
- "Your secrets never leave your machine" — security without complexity
- "The imagination chasm" — Cathy Di's intellectual framing for the market opportunity
- "Agent-to-Agent" (A2A) — the next infrastructure horizon

**Off-brand language:**
- "Comprehensive solution" — vague
- "AI-powered" — table stakes, means nothing
- "Enterprise-grade" without specifics — empty
- "Seamless integration" — overused, no substance
- Anything that sounds like it's for ML researchers rather than developers who want to ship

**One sentence:** Dedalus Labs is the infrastructure platform where developers build, deploy, and monetise production-grade AI agents — one SDK, any model, any tool, ship in minutes.

---

## Keywords & Signals to Monitor

Dedalus Labs, dedaluslabs.ai, Cathy Di, Catherine Di, Windsor Nguyen, AI agent infrastructure, MCP server deployment, Model Context Protocol infrastructure, agent SDK, agentic AI infrastructure, Vercel for AI agents, microVM AI agents, persistent AI agents, scale-to-zero agents, AI sandbox comparison, E2B alternative, Daytona alternative, Fly.io Sprites alternative, MCP marketplace, DAuth MCP authentication, YC S25 AI infrastructure, Kindred Ventures AI, Saga Ventures AI, Thomas Wolf Hugging Face investment, AI agent monetisation, agent-to-agent infrastructure, A2A agents, Break In hacker house, Dedalus Machines, Dedalus Hypervisor

---

## Load Into Juno (Dedalus Labs Workspace)

1. In the sidebar, select the **Dedalus Labs** workspace so saves hit the correct `client_workspace_profiles` row.
2. **Knowledge Base Document:** paste this full markdown file into the textarea, then **Save**.
3. Refresh — Juno should reflect Dedalus Labs context across all responses for that workspace.

If any previous company profile persists, use **Erase saved document**, re-paste this file, and **Save** again.
