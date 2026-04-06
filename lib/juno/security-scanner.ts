import type { RepoTreeEntry } from "@/lib/juno/github-repo"

const TIER_1_PATTERNS: RegExp[] = [
  /app\/api\/.+\/route\.(ts|js|tsx|jsx)$/,
  /pages\/api\/.+\.(ts|js|tsx|jsx)$/,
  /src\/app\/api\/.+\/route\.(ts|js)$/,
  /(^|\/)auth\//i,
  /(^|\/)middleware\.(ts|js)$/,
  /(^|\/)lib\/supabase/i,
  /\.env\.example$/,
  /\.env\.local\.example$/,
  /next\.config\.(js|mjs|ts)$/,
  /vercel\.json$/,
  /\.gitignore$/,
  /\.github\/workflows\/.+\.(yml|yaml)$/,
  /\.gitlab-ci\.yml$/,
  /^package\.json$/,
  /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/,
]

const TIER_2_PATTERNS: RegExp[] = [
  /(^|\/)lib\/.+\.(ts|js)$/,
  /(^|\/)utils\/.+\.(ts|js)$/,
  /(^|\/)services?\/.+\.(ts|js)$/,
  /webhook/i,
  /payment/i,
  /billing/i,
  /(^|\/)token/i,
  /secret/i,
  /crypto/i,
  /supabase\/migrations\/.+\.sql$/,
  /(^|\/)Dockerfile/,
  /docker-compose/,
  /\.tf$/,
]

const TIER_3_PATTERNS: RegExp[] = [
  /prompt/i,
  /(^|\/)agent/i,
  /inngest/i,
  /anthropic/i,
  /openai/i,
  /\.claude\//,
  /SKILL\.md$/i,
]

const MAX_FILES = 50
const MAX_FILE_SIZE = 30_000
/** Avoid multi-megabyte prompts that stall providers for tens of minutes. */
const MAX_TREE_PATH_LINES = 2_500
const MAX_TOTAL_FILE_BODY_CHARS = 120_000

export function selectFiles(tree: RepoTreeEntry[]): string[] {
  const selected: string[] = []
  const pushTier = (patterns: RegExp[]) => {
    for (const file of tree) {
      if (selected.length >= MAX_FILES) return
      if (file.size > MAX_FILE_SIZE) continue
      if (patterns.some((p) => p.test(file.path))) {
        if (!selected.includes(file.path)) selected.push(file.path)
      }
    }
  }
  pushTier(TIER_1_PATTERNS)
  pushTier(TIER_2_PATTERNS)
  pushTier(TIER_3_PATTERNS)
  return selected
}

export type SecurityCommitSummary = { sha: string; message: string; date: string; files: string[] }

export function buildSecurityScanPrompt(
  files: Array<{ path: string; content: string }>,
  tree: RepoTreeEntry[],
  commits: SecurityCommitSummary[],
  repoName: string,
  mode: "daily" | "comprehensive" = "daily",
): string {
  const confidenceGate = mode === "daily" ? 8 : 2

  const paths = tree.map((f) => f.path)
  const treeLines =
    paths.length <= MAX_TREE_PATH_LINES
      ? paths.join("\n")
      : `${paths.slice(0, MAX_TREE_PATH_LINES).join("\n")}\n\n(... ${paths.length - MAX_TREE_PATH_LINES} more paths omitted. Selection still uses full tree metadata on the server.)`

  const perFileCap = 5000
  const fileBlockParts: string[] = []
  let used = 0
  let included = 0
  for (const f of files) {
    const body =
      f.content.length > perFileCap
        ? `${f.content.slice(0, perFileCap)}\n[...truncated at ${perFileCap} chars]`
        : f.content
    const block = `\n--- ${f.path} ---\n${body}`
    if (included > 0 && used + block.length > MAX_TOTAL_FILE_BODY_CHARS) {
      fileBlockParts.push(
        `\n[... ${files.length - included} more files omitted; total file context capped at ${MAX_TOTAL_FILE_BODY_CHARS} characters.]`,
      )
      break
    }
    fileBlockParts.push(block)
    used += block.length
    included += 1
  }
  const fileBlocks = fileBlockParts.join("\n")

  const commitLines = commits
    .map((c) => `${c.sha.substring(0, 7)} ${c.message.split("\n")[0]} [${c.files.join(", ")}]`)
    .join("\n")

  const modeDaily = mode === "daily"

  return `You are a Chief Security Officer conducting a security audit.
You think like an attacker but report like a defender. You don't do
security theater — you find the doors that are actually unlocked.

REPO: ${repoName}
MODE: ${mode} (confidence gate: ${confidenceGate}/10)
FILES ANALYSED: ${files.length}
TOTAL REPO FILES: ${tree.length}

${
  modeDaily
    ? "DAILY MODE: Only report findings with 8/10+ confidence. Zero noise. Only report what you're sure about."
    : "COMPREHENSIVE MODE: 2/10 confidence bar. Flag anything that MIGHT be an issue. Mark low-confidence findings as TENTATIVE."
}

=== FILE TREE (all paths in repo) ===
${treeLines}

=== FILE CONTENTS ===
${fileBlocks}

=== RECENT COMMITS (last 30 days) ===
${commitLines}

=== AUDIT PHASES ===

Analyse the code above through these lenses, in order:

PHASE 0 — ARCHITECTURE MENTAL MODEL
Identify the tech stack, framework, deployment target. Map the
application architecture: components, trust boundaries, data flow.

PHASE 1 — ATTACK SURFACE
Count: public endpoints, authenticated endpoints, admin endpoints,
file upload points, webhook handlers, background jobs.

PHASE 2 — SECRETS
Look for: hardcoded API keys (AKIA, sk-, ghp_, xoxb-, re_),
secrets in client-side code, .env files in the repo tree,
CI configs with inline credentials (not using \${{ secrets.* }}).

PHASE 3 — DEPENDENCIES
Analyse package.json: look for known vulnerable packages,
packages with concerning install scripts, missing lockfile,
abandoned/typosquatted packages.

PHASE 4 — CI/CD
Analyse workflow files: unpinned third-party actions,
pull_request_target with checkout, script injection via
\${{ github.event.* }} in run steps, secrets as env vars.

PHASE 5 — INFRASTRUCTURE
Dockerfiles: root user, secrets in ARG, .env copied in.
Config files: prod database URLs with credentials committed.

PHASE 6 — WEBHOOKS & INTEGRATIONS
Find webhook handlers. Check if they verify signatures
(hmac, stripe-signature, svix). Unverified webhooks = finding.

PHASE 7 — LLM/AI SECURITY
User input flowing into system prompts. Unsanitised LLM output
rendered as HTML. Eval/exec of LLM responses. Missing tool call
validation. Unbounded LLM API calls (cost attack).

PHASE 8 — SKILL SUPPLY CHAIN
Any .claude/ skills: check for credential exfiltration,
prompt injection, suspicious network calls.

PHASE 9 — OWASP TOP 10
A01 Broken Access Control: missing auth on routes, IDOR.
A02 Crypto Failures: weak hashing, hardcoded secrets.
A03 Injection: SQL injection, command injection, template injection.
A04 Insecure Design: missing rate limits on auth.
A05 Misconfiguration: CORS wildcard, debug mode, verbose errors.
A07 Auth Failures: session management, JWT expiration.
A09 Logging Failures: auth events not logged.
A10 SSRF: URL construction from user input.

=== FALSE POSITIVE RULES ===

AUTOMATICALLY EXCLUDE:
- DoS / rate limiting / resource exhaustion (EXCEPT LLM cost attacks)
- Secrets stored encrypted or properly permissioned
- Input validation on non-security fields without proven impact
- Missing hardening measures (flag concrete vulns, not absent best practices)
  EXCEPTION: unpinned actions and missing CODEOWNERS ARE concrete
- Race conditions unless concretely exploitable
- Outdated deps without known CVEs
- Test fixtures not imported by non-test code
- User content in user-message position of AI conversation
- Regex complexity on non-user input
- Security concerns in *.md files
  EXCEPTION: SKILL.md files ARE executable prompt code
- Missing audit logs alone
- Insecure randomness in non-security contexts
- Docker issues in Dockerfile.dev / Dockerfile.local

PRECEDENTS:
- Logging secrets in plaintext IS a vulnerability
- UUIDs are unguessable — don't flag missing UUID validation
- Env vars and CLI flags are trusted input
- React/Angular are XSS-safe by default — only flag escape hatches
- Client-side JS doesn't need auth — server's job
- Shell command injection needs a concrete untrusted input path

=== OUTPUT FORMAT ===

Return a JSON array of findings. Each finding:

{
  "severity": "CRITICAL" | "HIGH" | "MEDIUM",
  "confidence": 1-10,
  "status": "VERIFIED" | "UNVERIFIED" | "TENTATIVE",
  "phase": 0-9,
  "phaseName": "string",
  "category": "secrets" | "auth" | "injection" | "access_control" |
    "rate_limiting" | "data_exposure" | "dependency" | "configuration" |
    "cicd" | "infrastructure" | "webhook" | "llm_security" |
    "skill_supply_chain" | "crypto" | "ssrf",
  "title": "Short specific title",
  "filePath": "path/to/file.ts",
  "lineNumber": null or number,
  "codeSnippet": "2-5 lines of problematic code",
  "description": "What's wrong — be specific",
  "exploitScenario": "Step-by-step: how an attacker exploits this",
  "impact": "What the attacker gains",
  "fixSuggestion": "Exactly what to do — show code if possible",
  "fixEffort": "5 minutes" | "30 minutes" | "few hours" | "significant refactor",
  "fixCode": "The corrected code if simple, null if complex",
  "fingerprint": "category:filePath:normalised-title"
}

RULES:
- Every finding MUST have an exploit scenario. "This is insecure" is not enough.
- ${modeDaily ? "Only report findings with confidence >= 8." : "Report anything >= 2 confidence. Mark < 8 as TENTATIVE."}
- Maximum 15 findings. Quality over quantity.
- Name the file, the line, the function. Be concrete.
- If the codebase is genuinely secure, return an empty array.

Return ONLY the JSON array. No preamble, no markdown fences.`
}

export type RawSecurityFinding = {
  severity?: string
  confidence?: number
  status?: string
  phase?: number
  phaseName?: string
  category?: string
  title?: string
  filePath?: string
  lineNumber?: number | null
  codeSnippet?: string
  description?: string
  exploitScenario?: string
  impact?: string
  fixSuggestion?: string
  fixEffort?: string
  fixCode?: string | null
  fingerprint?: string
}

export function parseSecurityFindingsJson(text: string): RawSecurityFinding[] {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0]) as RawSecurityFinding[]
  } catch {
    return []
  }
}

function normalizeSeverity(s: string | undefined): "critical" | "high" | "medium" | "low" {
  const u = (s || "").toUpperCase()
  if (u === "CRITICAL") return "critical"
  if (u === "HIGH") return "high"
  if (u === "LOW") return "low"
  return "medium"
}

export function normalizeFindingForDb(f: RawSecurityFinding, scanId: string, userId: string) {
  const fp =
    f.fingerprint ||
    `${f.category || "unknown"}:${f.filePath || "?"}:${(f.title || "untitled").toLowerCase().replace(/\s+/g, "-")}`
  return {
    user_id: userId,
    scan_id: scanId,
    severity: normalizeSeverity(f.severity),
    category: f.category ?? null,
    title: (f.title || "Finding").slice(0, 500),
    description: f.description ?? null,
    file_path: f.filePath ?? null,
    line_number: f.lineNumber ?? null,
    code_snippet: f.codeSnippet ?? null,
    fix_suggestion: f.fixSuggestion ?? null,
    fix_effort: f.fixEffort ?? null,
    fix_code: f.fixCode ?? null,
    exploit_scenario: f.exploitScenario ?? null,
    confidence: typeof f.confidence === "number" ? f.confidence : null,
    verification_status: f.status ?? "UNVERIFIED",
    fingerprint: fp.slice(0, 500),
    phase: typeof f.phase === "number" ? f.phase : null,
    phase_name: f.phaseName ?? null,
    impact: f.impact ?? null,
    status: "open" as const,
  }
}
