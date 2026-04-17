# Ocular AI — Juno Context

*Fully researched brief for agents and team members. Compiled from: useocular.com (all pages + blog), YC company page, The Condia, Hypepotamus, Crunchbase, ChoppingBlock AI, RankNCompare, LinkedIn (Michael Moyo, Louis Murerwa). Last updated April 2026.*

---

## What They Are Building

Ocular AI is the **data engine for multimodal AI** — a unified platform where AI and computer vision teams ingest, curate, search, annotate, and train models on unstructured multimodal data at scale.

The core thesis is simple but critical: compute and algorithms have advanced exponentially, but **data is now the bottleneck**. Most readily accessible internet data has already been consumed by frontier models. The next wave of AI progress — in robotics, autonomous vehicles, medical imaging, generative AI, voice AI — will be determined not by who has the best model architecture, but by who has the highest-quality, freshest, most precisely labelled training data.

Ocular is building the infrastructure layer that produces that data.

**How they describe themselves:**
- *"The Multimodal Data Layer for the Multimodal AI Era"*
- *"The Data Foundry for the Multi-Modal AI Era"*
- *"Ingest, curate, search & annotate zettabytes of unstructured multimodal data into golden datasets — then train and evaluate powerful, custom AI models on one unified, collaborative platform."*
- *"Data is the lifeblood of AI."* — Michael Moyo, CEO

**YC batch:** W24 (Winter 2024)
**HQ:** San Francisco, CA (with Atlanta presence)

---

## The Problem

Three compounding failures drive the market Ocular is building for:

**1. Data is the new compute bottleneck**
The easy internet data is gone. Frontier labs have ingested it. The next performance gains in AI — particularly for specialised domains like autonomous driving, robotics, medical AI, and voice — require fresh, domain-specific, human-labelled data that doesn't exist in public form. Self-driving cars fail in unpredictable real-world environments. Robots break outside controlled conditions. Medical AI stalls on rare disease diagnosis. The root cause in each case: insufficient high-quality training data for the edge cases that matter.

**2. Annotation is slow, expensive, and fragmented**
Traditional data labelling is manual, inconsistent, and uses general-purpose human labour that doesn't understand domain context. A medical imaging annotation job needs radiologists, not crowdsourced workers. An audio emotion annotation job needs native speakers who understand cultural nuance. The tools to manage this — across video, image, audio, and structured data simultaneously — don't exist in one place. Teams stitch together five different tools and spend more time on data wrangling than on model development.

**3. Voice AI has almost no annotated data**
Voice AI is one of the fastest-growing AI categories, but the annotated datasets to train high-quality TTS and emotion-aware voice models barely exist. Text AI benefits from decades of internet-scale labelled data. Voice data — particularly natural, emotional, multilingual voice — has to be built from scratch. Nobody has organised or annotated it at scale. This is a category-level gap Ocular has moved aggressively to fill.

---

## Product: Full Detail

### Ocular Foundry (Core Platform)

An end-to-end multimodal lakehouse. Every step of the data-to-model pipeline in one unified system — no data movement, no context switching between tools.

**Data Ingestion & Centralisation**
- Ingest from cloud (AWS, GCP, Azure) and local sources
- Supports video, image, audio, and unstructured data types
- Data stays on existing customer infrastructure — no third-party data sharing
- Collaborative workspace with role-based access control
- SOC 2 Type II certified

**Multimodal Data Catalog**
- Vector embeddings generated automatically for intelligent semantic search
- Natural language search across video, image, and audio without manual tagging ("person entering doorway at night" returns results with timeline visualisation and AI-generated scene summaries)
- Dataset discovery, deduplication, and quality scoring
- Command-palette interface (⌘ + P) for instant access
- Share and reuse indexed datasets across multiple AI projects
- Automatic detection of poor-quality or corrupted data points

**Data Annotation**
- Frame-by-frame and batch annotation for video and image
- Time-based annotation capabilities for audio/video
- Flexible accuracy thresholds and confidence score settings
- Human review queue for low-confidence agent outputs
- Export in COCO, YOLO, and JSON formats

**Data Agents (Agentic Labelling)**
Automated annotation at scale using AI agents — reducing annotation time by 90% and costs by 80% versus manual processes:
- Agents process data directly on the annotation canvas
- Uses pre-trained foundation models: DeepSeek, Microsoft, Meta (LLaMA), Google, Mistral, Ultralytics (YOLO)
- Custom models trained on customer-specific data for domain accuracy
- Human annotators handle quality control; agents handle volume
- Configurable confidence thresholds trigger human review automatically
- Systematic error detection before data propagates into training

**Dataset Versioning**
- Branching and version control for reproducible experiments
- Intelligent dataset splitting (train/validation/test)
- Dataset version-level analytics and label distribution graphs
- Training/validation split visibility to catch class imbalances before training

**GPU Model Training (One-Click)**
Train specialised models directly on the lakehouse — no data movement required:
- Launched Launch Week III (July 2025)
- Architectures supported: YOLOv11 across multiple variants
- Hyperparameter configuration and comparative analysis across model versions
- Comprehensive training performance analytics (Precision, Recall, mAP50)
- Enterprise-grade security and governance maintained throughout training

**Foundry Analytics**
Real-time workflow visibility across projects and dataset versions:
- Project overview metrics: batch counts, job status distribution, frame usage
- Dataset version analytics: label distributions, training/validation splits
- Catches data quality issues before they propagate into model training

**Ocular SDK**
Python-based. Programmatic access to workspaces, projects, dataset versions, and exports. RESTful API for search integration into external applications.

---

### Ocular Bolt (Expert Labelling Service)

Where Foundry is the self-serve platform, Bolt is the managed service — combining AI automation with domain expert human oversight.

- **"Experts in the Loop"** — not just human-in-the-loop, but specialists: medical doctors, engineers, legal professionals, and subject-matter experts who understand the domain
- On-demand, scalable annotation workforce deployed globally
- RLHF-style feedback and model evaluation and alignment
- Handles any data volume, any complexity, under tight deadlines
- Private and secure, compliant with industry standards
- Pricing: custom per project (contact sales)

**Where Bolt wins:** regulated industries (medical, legal, automotive), high-stakes annotation where generalist crowdworkers fail, and complex multimodal jobs that require cultural or domain knowledge.

---

### The Voice Data Initiative ($2M+)

Ocular AI has made a significant strategic investment specifically in building voice data infrastructure — an area where the gap between what AI needs and what exists is arguably larger than anywhere else in ML.

**The problem Michael Moyo identified:**
Early experiments training TTS models on publicly available voice data produced results that sounded fine on podcasts but failed entirely for emotional, creative, and multilingual applications. Getting natural, emotional, multilingual voice data is a completely different problem — nobody has annotated or organised it at the quality level production voice AI requires.

**What Ocular built in response:**
- Custom in-house ASR (Automatic Speech Recognition) model for audio labelling
- Emotion annotation pipeline built from the ground up
- Voice separation and audio quality models developed internally
- Native speakers hired globally to label preference data for reward model training
- RLHF-style preference data collection for voice model alignment

This positions Ocular as one of the few data infrastructure companies that has seriously invested in the annotation tooling and human pipeline specifically for voice AI — a category gap that TTS companies (ElevenLabs, Cartesia, PlayHT, etc.) all face but most are solving ad hoc.

---

## Confirmed Use Cases & Verticals

- **Autonomous driving** — urban imagery dataset annotation; unpredictable real-world edge case labelling
- **Robotics** — training data for robots operating outside controlled environments; powering robotics companies (specifically called out in their GTM)
- **Medical AI** — rare disease imaging datasets; annotation requiring medical domain experts via Bolt
- **Warehouse / logistics** — object detection, quality control, inventory monitoring
- **Generative AI / LLMs** — frontier model training data curation and RLHF
- **Computer vision** — general model development across industries
- **Voice AI** — TTS training data, emotion annotation, multilingual speech datasets

---

## Founding Team

**Michael Moyo — CEO & Co-founder**
Zambian. Dartmouth College — Biomedical & Computer Engineering. Former software engineer at Microsoft (Washington State). Serial founder before Ocular: founded The MentalLiberty Foundation (Lusaka-based mental healthcare organisation), co-founded Ipahive (Zambian fintech for SME financing), and Qurre Health. Brings both enterprise engineering depth and founder-operator experience from building in emerging markets. His thesis: *"Ocular AI is born out of a vision to revolutionize how teams interact with their work, engineering tools and data."*

**Louis Murerwa — CTO & Co-founder**
Zimbabwean. Dartmouth College — Computer Science. Two internships at Google, then full-time software engineer at Google NYC where he built distributed architecture powering Google Cloud. Left Google in January 2024 to co-found Ocular. Among the first Zimbabweans accepted into Y Combinator. His grounding problem: *"Finding the information needed to do our jobs was very painful. It took a lot of time."*

The two met at Dartmouth around 2017/2018, where artificial intelligence was first established as a field in 1956 — a connection the company is deliberate about. Both arrived on full scholarships. They reconnected in 2024 and entered YC together.

**Extended team (6 people total):**
- Maria Cristoforo — Member of Technical Staff
- Vivek Lahole — Member of Technical Staff (IIT Roorkee)
- Philip Okiokio — Member of Technical Staff
- Additional engineers

---

## Investors & Funding

**Total raised: ~$2.5M across two seed rounds**

| Round | Amount | Date | Lead |
|---|---|---|---|
| Seed (initial) | $500K | February 2024 | Y Combinator |
| Seed (extension) | $2M | November 2024 | Drive Capital |

**Investors:**
| Investor | Notes |
|---|---|
| Y Combinator | W24 batch |
| Drive Capital | Atlanta-based; Avoilan Bingham introduced through Atlanta network; early conviction |
| BDMI Fund | — |
| Alumni Ventures | — |
| Orange Collective | — |
| myAsiaVC | — |

**Angel syndicate:** Entrepreneurs and operators who have previously backed Stripe, Airbnb, DoorDash, Coinbase, Twitch, and Cruise.

Funding is early-stage pre-Series A. The $2M November 2024 round was specifically tied to the voice data initiative and platform expansion.

---

## GTM & Strategic Moves

**Atlanta relocation (July 2024)**
After YC in SF, the team partially relocated to Atlanta — a deliberate GTM decision:
- Georgia Tech hosts one of the top AI programmes in the country → talent pipeline
- Atlanta has one of the largest concentrations of Fortune 500 companies → direct enterprise sales access
- Drive Capital, an Atlanta-based investor, became an early backer through this network

Murerwa: *"Atlanta provides us with talent but also the opportunity to sell into enterprise companies."*

**Open-source foundation**
Started as an open-source enterprise search project. Open-source roots built developer trust and community before commercialising — the same model that worked for Supabase, Hugging Face, and Roboflow.

**Launch Weeks**
Three structured product launch weeks (December 2024, March 2025, July 2025) to drive developer attention and structured media coverage — modelled on Supabase's launch week playbook.

**Break In adjacency**
Ocular AI was named as a production partner by Dedalus Labs at their seed announcement — validating cross-portfolio credibility within the YC S25/W24 ecosystem.

---

## Competitive Landscape

### Direct Competitors

**Scale AI**
The dominant player in data annotation — massive workforce, used by OpenAI, Meta, the US government. Acquired by Meta in 2024, which caused some enterprise and government clients to explore alternatives over data governance concerns. Scale is for massive volume with a managed workforce. Ocular's counter: unified multimodal platform (Scale is annotation-first, not a full data lakehouse); post-Meta acquisition creates conflict-of-interest concerns for companies building competing AI; Ocular's expert-in-the-loop model via Bolt competes on quality rather than raw volume.

**Labelbox**
Platform-first vendor, strong for in-house teams managing labelling workflows. Excellent for distributed annotation operations and auditability. Ocular's counter: Labelbox is annotation tooling — not a full lakehouse with training, search, and model evaluation built in. Ocular collapses the entire data-to-model pipeline.

**Encord**
Leading computer vision annotation platform. Strong SOC2/HIPAA/GDPR compliance, advanced automation, multimodal support. Direct competitor in computer vision annotation. Ocular's counter: Encord is annotation-first; Ocular adds the full upstream (data ingestion, cataloguing, semantic search) and downstream (GPU training, evaluation, model library) layers. Encord has no voice data infrastructure.

**Roboflow**
Default entry point for computer vision teams. Easy to use, strong community, good for getting started quickly. Ocular's counter: Roboflow is optimised for image/video CV teams at startup scale; Ocular targets enterprise-grade, multimodal (including audio/voice), and high-stakes domains (medical, autonomous vehicles) where Roboflow doesn't play.

**Activeloop / Deep Lake**
Data versioning and lakehouse for ML teams. $40/month entry pricing, well-rated (8.2/10). More developer-facing than enterprise. Ocular's counter: Activeloop focuses on data management; Ocular adds annotation, Bolt's expert workforce, GPU training, and voice data infrastructure.

**Snorkel AI**
Programmatic labelling using weak supervision. Strong for NLP and structured data. Ocular's counter: Snorkel requires engineering sophistication; Ocular is more accessible, covers multimodal data types Snorkel doesn't, and combines human expert annotation with AI agents.

### Where Ocular Wins
- **Only unified platform** — ingestion + catalog + search + annotation + agents + training + evaluation in one system (every competitor is a subset)
- **Expert-in-the-loop via Bolt** — domain specialists (doctors, engineers) not just crowdworkers — critical for medical, legal, and scientific annotation
- **Voice data infrastructure** — custom ASR, emotion annotation, native speaker workforce — no direct competitor has invested here at this depth
- **Data sovereignty** — stays on customer's existing infrastructure, no third-party data exposure
- **SOC 2 Type II** at early stage — enterprise security without enterprise pricing friction
- **Robotics positioning** — specifically calling out robotics companies as a primary GTM target, a fast-growing vertical with acute data needs
- **Post-Meta/Scale dynamic** — companies wary of Scale AI post-acquisition have an obvious alternative to evaluate

### Where the Risk Sits
- Scale AI has orders-of-magnitude more resources and workforce at scale
- Encord and Labelbox have significant head starts in enterprise annotation tooling
- 6-person team against well-funded, larger competitors
- No public pricing — a barrier for PLG (product-led growth) and developer self-serve adoption
- Enterprise sales cycles are long; Atlanta + SF split team adds coordination overhead
- Voice data investment is speculative — success depends on TTS/voice AI companies paying for specialised annotated data rather than building it in-house

---

## Business Model

**B2B SaaS + Managed Services (two-track)**

1. **Ocular Foundry** — Platform subscription for AI/data teams. No public pricing; enterprise sales motion. Positioning: contact sales for custom quote based on data volume, team size, and compute needs.

2. **Ocular Bolt** — Managed annotation service. Project-based pricing, quoted per engagement. Revenue from human annotation workforce + AI automation layered on top.

3. **Ocular SDK / Search APIs** — Programmatic access for developers embedding multimodal search into their applications. Likely usage-based.

**Defensible moat logic:** Customers who have ingested, organised, annotated, and trained models on data inside Ocular's lakehouse have deep switching costs — the indexed datasets, annotation history, model versions, and workflow configurations are all embedded in the platform. The more data processed, the stickier the relationship.

---

## Strategic Priorities

Based on product trajectory through July 2025:

1. **Complete the pipeline** — One-click GPU training (launched July 2025) closes the loop from raw data to trained model entirely within Foundry. Next: model deployment and inference.
2. **Voice data at scale** — The $2M+ voice data investment is ongoing. Building the annotated voice dataset library and the tooling to produce it is a long-term infrastructure play.
3. **Robotics vertical** — Explicitly called out as a primary GTM target. Robotics companies need exactly what Ocular provides: continuous, high-quality, real-world sensor data annotation.
4. **Enterprise sales via Atlanta** — Fortune 500 companies in Atlanta's concentration are the near-term revenue base. Drive Capital's network is the entry point.
5. **Developer community** — Open-source notebooks, SDK, launch weeks, and community Slack are building bottom-up adoption alongside top-down enterprise sales.

---

## Voice & Communication

**On-brand language:**
- "Golden datasets" — the output standard Ocular produces
- "Multimodal lakehouse" — the infrastructure category they're defining
- "Data is the lifeblood of AI" — Moyo's core thesis
- "Experts in the loop" — the Bolt differentiator, above human-in-the-loop
- "No data movement required" — sovereignty and simplicity
- "From data to model" — the full pipeline they collapse
- "Frontier data" — fresh, high-quality, not scraped internet data
- "Data Agents" — autonomous annotation, not manual labelling

**Off-brand language:**
- "AI-powered" — table stakes
- "Comprehensive data platform" — vague
- "Enterprise-grade" without specifics
- "Seamless" — overused
- Anything that positions them as annotation-only (undersells the full lakehouse)

**One sentence:** Ocular AI is the multimodal data engine for AI teams — a unified platform to ingest, annotate, search, and train models on video, image, and audio data, with a managed expert labelling service and a specialised voice data infrastructure no competitor has matched.

---

## Keywords & Signals to Monitor

Ocular AI, useocular.com, Michael Moyo Ocular, Louis Murerwa Ocular, multimodal data lakehouse, AI training data platform, data annotation enterprise, computer vision data labelling, voice data annotation, TTS training data, emotion annotation voice, audio data labelling, Scale AI alternative, Labelbox alternative, Encord alternative, Roboflow enterprise alternative, data engine for AI, golden datasets, Ocular Foundry, Ocular Bolt, Ocular SDK, YC W24 data infrastructure, Drive Capital AI, robotics training data, autonomous vehicle data annotation, medical AI data labelling, RLHF data platform, multimodal annotation platform, data-to-model pipeline, frontier data AI

---

## Load Into Juno (Ocular AI Workspace)

1. In the sidebar, select the **Ocular AI** workspace so saves hit the correct `client_workspace_profiles` row.
2. **Knowledge Base Document:** paste this full markdown file into the textarea, then **Save**.
3. Refresh — Juno should reflect Ocular AI context across all responses for that workspace.

If any previous company profile persists, use **Erase saved document**, re-paste this file, and **Save** again.
