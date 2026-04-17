# Eragon — Juno Context

*Fully researched brief for agents and team members. Compiled from: eragon.ai (all pages), TechCrunch (March 2026), TAMradar, The AI Insider, MEXC, CryptoRank, Benzatine, StartupSamadhan, Development Corporate. Last updated April 2026.*

---

## What They Are Building

Eragon is an **Applied AI Lab** building the **AI Operating System for the enterprise**. The product replaces every software interface a company uses — Salesforce, Snowflake, Tableau, Jira, ERP, email, and everything else — with a single natural language layer.

Employees stop clicking through menus, toggling between apps, and wrestling with dashboards. They describe what they need in plain language. Eragon does it.

This is not a chatbot. This is not a copilot bolted on top of existing software. Eragon takes open-source foundation models, post-trains them on the customer's own proprietary data inside the customer's own secure cloud environment, and deploys autonomous agents that can take action — not just answer questions.

The trained model weights are owned by the customer. The data never leaves the customer's servers. The intelligence is theirs.

**Core taglines:**
- *"AI Operating System For Your Company"*
- *"Proprietary AI Powering The World Of Bits"*
- *"We Are An Applied AI Lab For Operational Intelligence"*
- *"Own Your Intelligence"*
- *"Software is dead."* — Josh Sirota, CEO

**The moat philosophy:** *"The moat is not which model you call. The moat is which model you own."*

---

## The Problem

The average enterprise runs 200+ software tools. Workers spend 20% of their working day — one full day every week — not doing their job, but searching for information across disconnected systems.

Despite billions poured into enterprise AI, **95% of corporate AI pilots deliver zero measurable P&L impact** (MIT NANDA Study). The failure is not the models. The failure is the deployment model:

- Centralised API products (GPT wrappers, generic copilots) don't understand company-specific data, workflows, or terminology
- Sending proprietary data to third-party AI providers creates compliance and sovereignty blockers that kill pilots in procurement
- Bolting a chatbot on top of existing software adds a UI layer but keeps all the underlying complexity
- Generic AI is identical to what every competitor can buy — it creates no compounding advantage

The status quo is enterprise software built for 1990s interaction patterns: buttons, dialog boxes, dropdown menus, tabs, and manual data entry across a dozen systems to complete a single task. It was designed for corporate IT departments, not the people doing the actual work.

Sirota's thesis: we are at the same inflection point the computing industry hit when the command line gave way to the graphical interface. The GUI was not an improvement to the command line — it replaced it. Prompts will not improve GUIs. They will replace them.

---

## Product: Full Detail

### The Five-Layer Platform

**1. Connect**
Eragon integrates with the customer's existing infrastructure — tools, data sources, databases, and channels — without replacing anything. No rip and replace. Confirmed integrations: Salesforce, Snowflake, Tableau, Jira, email, ERP systems. The company also links to internal knowledge bases, cloud storage, and other custom data sources.

**2. Train**
Open-source foundation models (currently Qwen and Kimi) are post-trained on the customer's proprietary data inside their own secure environment. The model learns the company's specific workflows, terminology, org structure, products, and processes. The resulting trained model weights are owned entirely by the customer — not by Eragon, not by any third-party model provider.

**3. Evaluate**
Agent performance is measured against actual business outcomes: accuracy, speed, and value delivered. Not token counts or satisfaction scores. Continuous benchmarking that feeds back into model improvement.

**4. Deploy**
Agents are deployed with individual memory, skills, and contextual awareness. Each agent has:
- **Persistent memory** — context that accumulates across conversations and over time, not just within a session
- **Modular skills** — customisable capabilities that can be built and added in minutes
- **Multi-agent orchestration** — tasks routed to the right agent automatically

**5. Operate**
Agents run autonomously, around the clock, across multiple surfaces. They monitor, act, learn, and escalate when human judgment is required. Human-in-the-loop safeguards are built in.

### The Gateway
A unified control plane managing all agents, channels, tools, events, and scheduling. Single pane of glass for the company's entire AI operating layer.

### Technical Architecture
- Self-hosted deployment on the customer's preferred infrastructure (cloud, on-premises, or custom hardware)
- Multi-model orchestration with automatic failover between models
- Per-agent, per-session, and per-task model switching
- Explicit approval requirements for all agent connections
- Sandboxed execution with permission-gated access
- Comprehensive audit trail logging every action and every session
- NIST-aligned audit trails

### Confirmed Agent Capabilities (Live in Production)
- **Employee onboarding via prompt** — assign credentials, spin up cloud instances, sync data sources, initiate onboarding workflows, all from a single natural language command
- **Customer onboarding automation** — Dedalus Labs demonstrated full client onboarding via prompt
- **Insurance underwriting** — Corgi deploys Eragon across their underwriting and internal operations workflows
- **Deal slippage analysis** — analyse CRM data and surface at-risk deals
- **Dashboard generation on demand** — generate board-ready revenue dashboards from plain language requests, pulling from connected data sources automatically
- **Supply chain optimisation recommendations**
- **Invoice approval workflows** (with appropriate human-in-the-loop controls for financial transactions)
- **Internal operations** — any recurring workflow that currently requires navigating multiple systems

---

## Market Context

**Enterprise software market:** The global enterprise software market is $340B (2026 estimate). The enterprise AI subsector is $28.38B (2025), projected $40.45B by 2026.

**The data problem:** At the foundation of every company are bits — ones and zeros, created every second, stored across every system. Traditional software stores them. Eragon's position: companies should be able to see all of it, connect all of it, and act on all of it — through AI that understands the specific company, not a generic model shared with every competitor.

**The subscription trap (Eragon's framing):** Companies currently send their proprietary context, workflows, and data through external AI infrastructure — simultaneously training competitors' models while receiving only generic capabilities. Every competitor can buy identical access to GPT-4 or Claude. Owning your trained weights creates a compounding advantage no competitor can replicate.

---

## Founding Team

**Josh Sirota — CEO & Co-founder**
Previously on go-to-market teams at Oracle, then scaled a Salesforce operating unit from inception to **$200M ARR**. He is not a researcher who decided to sell to enterprise. He built enterprise software from the inside — he knows the sales cycles, the procurement blockers, the IT security review, the change management problem, and what it actually takes to go from pilot to production. That firsthand understanding of why enterprise AI keeps failing in procurement is precisely what the product is designed to fix. Founded Eragon in August 2025, operating from a live-work loft in San Francisco.

**Rishabh Tiwari — Co-founder (Technical)**
Berkeley Computer Science PhD. Core technical architecture and model infrastructure.

**Vinayak (Vin) Agarwal — Co-founder & Head of Applied AI**
MIT PhD in Mechanical Engineering. At MIT, discovered "auditory intuitive physics." Previously co-founded **K-Dense**, an AI agent for scientific research, validated in collaboration with Harvard Medical School. Brings deep ML research background applied to enterprise agent deployment and fine-tuning.

---

## Investors & Funding

**Round:** $12M Seed
**Post-money valuation:** $100M
**Date:** March 2026
**Founded:** August 2025 (approximately 7 months from founding to close)

| Investor | Role | Notable Prior Investments |
|---|---|---|
| Arielle Zuckerberg | Long Journey Ventures — Lead | Crusoe, Together AI |
| Cyan Banister | Long Journey Ventures — Partner | Early Facebook, SpaceX, Uber, Postmates |
| Lee Jacobs | Long Journey Ventures — Partner | Co-led the round |
| Soma Capital | Co-lead | Early Databricks, Cognition Labs |
| Axiom Partners (Sandhya Venkatachalam) | Co-lead | Groq, Fireflies.ai |
| Roo Capital | Participant | — |
| Mike Knoop | Angel | Co-founder, Zapier |
| Elias Torres | Angel | Co-founder, Drift (acquired by Salesloft) |

**Investor quotes:**

- Sandhya Venkatachalam (Axiom Partners): *"We see enormous potential for Eragon to become the connective tissue for how modern teams operate and make decisions."*
- Investors collectively cited Sirota's experience implementing the world's premier corporate software as evidence of "founder-market fit"

**Sirota's stated ambition:** $1 billion valuation by end of 2026.

---

## Customers & Traction

**Named customers:**

**Corgi** (AI-native insurance carrier, YC S24, $108M raised)
- CEO Nico Laqua: *"Most of the data we have needs to remain secure and behind our own cloud. Eragon trains state-of-the-art models for us on our data. It's the best applied AI for enterprise in the market."*
- Website testimonial: *"The Eragon team understood our needs and moved so fast we couldn't believe it. From onboarding, to insurance underwriting, to internal operations — Eragon is like an extension of our team."*
- Use cases live: employee onboarding, insurance underwriting workflows, internal operations

**Dedalus Labs**
- Demonstrated full customer onboarding via a single natural language prompt

**Broader base:** Deployed across a handful of large enterprises and dozens of startups, including YC companies (e.g. Clodo — reached 50 customers in 50 weeks with Eragon).

Pricing and ARR not publicly disclosed.

---

## Competitive Landscape

### Direct Competitors

**Microsoft Copilot**
Deeply integrated into Microsoft 365 — Teams, Outlook, SharePoint, OneDrive, Word, Excel. The default choice for companies already on Microsoft infrastructure. Eragon's counter: Copilot uses centralised Microsoft models on Microsoft's infrastructure. Data goes to Microsoft. Customers don't own the model weights. The intelligence is generic, not trained on the specific company.

**Glean**
$7.2B valuation, ~$200M ARR (doubled in nine months). Strong knowledge graph, excellent enterprise search. Positioned on retrieval and search, not full agentic execution. Eragon's counter: Glean finds information, Eragon acts on it. Retrieval is a feature, not an OS.

**Nvidia NemoClaw** (announced GTC 2026)
Nvidia's enterprise-grade AI agent infrastructure. Built on OpenClaw (open-source), includes OpenShell runtime for agent sandboxing. Partner ecosystem: Adobe, Salesforce, SAP, ServiceNow, Siemens, CrowdStrike, Atlassian, Palantir. Currently early-stage alpha. Jensen Huang's framing — *"every single SaaS company will become Agentic as a Service"* — validates the category Eragon is building. Eragon's counter: NemoClaw is alpha software building toward production-readiness; Linux (the analogy Huang uses) took 11+ years from launch to commercial viability. Eragon is production today.

**Generic frontier AI lab APIs (OpenAI, Anthropic, Google)**
Centralised models, shared infrastructure, no customer data sovereignty, no fine-tuning on proprietary data, no customer ownership of weights. Same access for every competitor.

**AI wrapper startups**
Thin product layers built on third-party APIs. No proprietary training, no data sovereignty, no compounding moat when the underlying model improves.

### Where Eragon Wins
- Data stays inside the customer's cloud — the single biggest enterprise procurement unblock
- Customer owns trained model weights — compounding advantage that competitors can't replicate
- Open-source foundation models post-trained on proprietary data — cost-efficient, customisable, not dependent on any one provider
- Full agentic execution — not search or summarisation but autonomous action across systems
- Founder lived the enterprise procurement cycle from inside Oracle and Salesforce

### Acknowledged Risks
- Anthropic's Model Context Protocol (MCP) is systematically commoditising the connector layer — integration breadth alone is not a moat
- Large enterprise procurement averages 9 months pilot-to-contract — long sales cycles against a $100M seed valuation
- Autonomous financial transaction workflows (invoice approval) trigger compliance review that can halt pilots
- Microsoft and Salesforce could replicate on-premise fine-tuning as a feature within their existing platforms
- 95% enterprise AI failure rate means significant buyer scepticism regardless of product quality

---

## Business Model

B2B enterprise software. Eragon sells the platform to companies who want custom-trained AI agents running inside their own infrastructure.

Revenue structure not publicly disclosed. Given the architecture (custom model training per customer, self-hosted deployment, ongoing agent operation), the model is likely:
- Annual enterprise contracts
- Combination of platform fee + training/deployment services
- Possible usage-based component for agent activity

**Defensible revenue logic:** Customers who have trained a model that deeply understands their specific company — their workflows, their data, their terminology — do not want to start over. Lock-in is on capability, not contract.

---

## Strategic Priorities

Based on funding announcement (March 2026):

1. **Core platform development** — expand agent capabilities, deepen integrations, productionise multi-agent orchestration
2. **Marquee enterprise customer acquisition** — sign recognised brand-name enterprises to validate beyond startup-native use cases
3. **Security and compliance hardening** — build the audit trail, permissioning, and governance infrastructure that enterprise IT requires for production deployment
4. **Path to $1B valuation by end of 2026** — Sirota's public commitment requires significant revenue or next-round milestones within 9 months of seed close

---

## Vision: Own Your Intelligence

*Direct from eragon.ai/vision:*

The competitive advantage of the next era belongs to companies that own their intelligence infrastructure. Every organisation sending proprietary data through external AI infrastructure is simultaneously training competitors' models and receiving only generic capabilities — identical to what any competitor can buy.

The "Bits Economy" framing: organisations are fundamentally collections of data — bits encoded across every system. Traditional software stores bits. Eragon's position is that companies should process those bits through owned intelligence that understands, connects, and acts on them.

Purpose-built agents trained on company-specific data outperform general assistants. Agents that remember organisational context and run on owned weights deliver measurable, compounding value rather than one-time improvements.

The Marshall McLuhan quote Eragon uses internally: *"We shape our tools, and thereafter our tools shape us."*

---

## Voice & Communication

**On-brand language:**
- "AI Operating System" — the category they're defining
- "Own Your Intelligence" — data sovereignty and ownership
- "Your weights. Your intelligence." — customer ownership, not vendor lock-in
- "Software is dead" — bold, provocative, founder conviction
- "Applied AI Lab" — research-grade rigour applied to production problems
- "Agentic" — agents that act, not assistants that answer
- "Operational Intelligence" — business outcomes, not AI metrics
- "Connect. Train. Evaluate. Deploy. Operate." — process clarity

**Off-brand language:**
- "Copilot" — associated with wrapper products that don't fundamentally change the interface
- "Chatbot" — wildly undersells what the agents do
- "AI-powered" — every product says this, means nothing
- "Comprehensive platform" — vague, no substance
- "Partnership" in the vendor sense — they are replacing vendors, not partnering with them
- Any language implying customer data leaves the customer's environment

**One sentence:** Eragon is the AI Operating System for enterprise — it replaces your software interfaces with a single natural language layer, trained on your data, running in your cloud, with the model weights owned by you.

---

## Keywords & Signals to Monitor

eragon.ai, Josh Sirota Eragon, Rishabh Tiwari Eragon, Vinayak Agarwal Eragon, AI operating system enterprise, agentic AI OS, enterprise AI agents, own your AI, AI model weights enterprise, on-premise AI fine-tuning, open-source LLM enterprise, Qwen enterprise fine-tuning, Kimi enterprise, Long Journey Ventures AI, Soma Capital AI portfolio, Axiom Partners AI, Cyan Banister investment, enterprise AI failure rate, 95 percent AI pilots fail, AI copilot vs AI agent, software is dead, enterprise prompt-based software, NemoClaw Eragon, Glean alternative, Microsoft Copilot alternative, enterprise AI OS, Corgi Eragon, K-Dense AI, operational intelligence platform, AI workflow automation enterprise, MCP enterprise AI, enterprise AI data sovereignty, model weight ownership

---

## Load Into Juno (Eragon Workspace)

1. In the sidebar, select the **Eragon** workspace so saves hit the correct `client_workspace_profiles` row.
2. **Knowledge Base Document:** paste this full markdown file into the textarea, then **Save**.
3. Refresh the page — Juno should reflect Eragon context across all responses for that workspace.

If any previous company profile persists, use **Erase saved document**, re-paste this file, and **Save** again.
