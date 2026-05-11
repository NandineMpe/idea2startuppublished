import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises"
import path from "path"
import { createHash, randomUUID } from "crypto"
import { createClient } from "@supabase/supabase-js"

type Fixture = {
  name: string
  resumeText: string
  linkedinText: string
  expected: {
    current_role?: string
    years_experience?: number
    skills?: Array<{ canonical_skill_key?: string }>
    past_roles?: Array<{ title?: string; company?: string }>
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

function canonicalSkillKey(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

async function loadFixtures(fixturesDir: string): Promise<Fixture[]> {
  const entries = await readdir(fixturesDir)
  const baseNames = [...new Set(entries.map((f) => f.replace(/\.(resume|linkedin|expected)\.(txt|json)$/, "")))]
  const out: Fixture[] = []
  for (const name of baseNames) {
    const resumeText = await readFile(path.join(fixturesDir, `${name}.resume.txt`), "utf8")
    const linkedinText = await readFile(path.join(fixturesDir, `${name}.linkedin.txt`), "utf8")
    const expectedRaw = await readFile(path.join(fixturesDir, `${name}.expected.json`), "utf8")
    out.push({ name, resumeText, linkedinText, expected: JSON.parse(expectedRaw) })
  }
  return out
}

async function main() {
  const baseUrl = process.argv[2]
  const verifyToken = process.argv[3]
  if (!baseUrl || !verifyToken) {
    throw new Error("Usage: npx tsx scripts/careeros/eval-profile-extraction.ts <base-url> <verify-token>")
  }

  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  })
  const inngestEventKey = requireEnv("INNGEST_EVENT_KEY")

  const fixturesDir = path.join(process.cwd(), "test", "careeros", "fixtures", "profiles")
  const fixtures = await loadFixtures(fixturesDir)
  const createdUserIds: string[] = []
  const rows: string[] = []
  rows.push("| Fixture | Schema validity | Skill recall | Skill precision | Role accuracy | Years accuracy | Hallucinated roles |")
  rows.push("|---|---:|---:|---:|---:|---:|---:|")

  let schemaValidityCount = 0
  let totalRecall = 0
  let totalPrecision = 0
  let roleAccuracyCount = 0
  let yearsAccuracyCount = 0
  let hallucinations = 0

  for (const fixture of fixtures) {
    const email = `eval-${fixture.name}-${Date.now()}@careeros-eval.local`
    const password = randomUUID()
    const userRes = await sb.auth.admin.createUser({ email, password, email_confirm: true })
    if (userRes.error || !userRes.data.user) throw userRes.error ?? new Error("create user failed")
    const userId = userRes.data.user.id
    createdUserIds.push(userId)

    const now = new Date().toISOString()
    const resumeDocId = randomUUID()
    const linkedinDocId = randomUUID()

    const { error: resumeDocError } = await sb.schema("careeros").from("user_documents").insert({
      id: resumeDocId,
      user_id: userId,
      doc_type: "resume",
      version: 1,
      storage_bucket: "careeros-documents",
      storage_path: `eval/${userId}/resume.txt`,
      text_hash: sha(fixture.resumeText),
      content_mime_type: "text/plain",
      content_bytes: fixture.resumeText.length,
      created_at: now,
      updated_at: now,
    })
    if (resumeDocError) throw resumeDocError

    const { error: linkedinDocError } = await sb.schema("careeros").from("user_documents").insert({
      id: linkedinDocId,
      user_id: userId,
      doc_type: "linkedin",
      version: 1,
      storage_bucket: "careeros-documents",
      storage_path: `eval/${userId}/linkedin.txt`,
      text_hash: sha(fixture.linkedinText),
      content_mime_type: "text/plain",
      content_bytes: fixture.linkedinText.length,
      created_at: now,
      updated_at: now,
    })
    if (linkedinDocError) throw linkedinDocError

    const { error: exError } = await sb.schema("careeros").from("user_document_extractions").insert([
      {
        user_id: userId,
        user_document_id: resumeDocId,
        parser_name: "careeros-eval",
        parser_version: "1",
        extraction_version: 1,
        is_current: true,
        parsed_payload: { plain_text: fixture.resumeText },
        input_data_version: sha(fixture.resumeText),
        source_attribution: {},
      },
      {
        user_id: userId,
        user_document_id: linkedinDocId,
        parser_name: "careeros-eval",
        parser_version: "1",
        extraction_version: 1,
        is_current: true,
        parsed_payload: { plain_text: fixture.linkedinText },
        input_data_version: sha(fixture.linkedinText),
        source_attribution: {},
      },
    ])
    if (exError) throw exError

    const ingestRes = await fetch(`https://inn.gs/e/${inngestEventKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "careeros/profile.extract",
        data: { user_id: userId, onboarding_completion_id: randomUUID() },
      }),
    })
    if (!ingestRes.ok) throw new Error(`Inngest ingest failed for ${fixture.name}`)

    let extractionStatus = "none"
    for (let i = 0; i < 24; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      const verifyRes = await fetch(
        `${baseUrl}/api/careeros/_verify/extraction?token=${encodeURIComponent(verifyToken)}&user_id=${encodeURIComponent(userId)}`,
      )
      if (!verifyRes.ok) continue
      const verifyJson = (await verifyRes.json()) as { extraction_status?: string }
      extractionStatus = verifyJson.extraction_status ?? "none"
      if (extractionStatus === "completed" || extractionStatus === "failed") break
    }

    const { data: extraction } = await sb
      .schema("careeros")
      .from("user_document_extractions")
      .select("parsed_payload")
      .eq("user_id", userId)
      .eq("parser_name", "careeros-profile-extract")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const payload = (extraction?.parsed_payload as Record<string, unknown> | undefined) ?? {}
    const gotSkills = Array.isArray(payload.skills)
      ? (payload.skills as Array<{ canonical_skill_key?: string }>).map((s) =>
          canonicalSkillKey(String(s.canonical_skill_key ?? "")),
        )
      : []
    const expectedSkills = (fixture.expected.skills ?? [])
      .map((s) => canonicalSkillKey(String(s.canonical_skill_key ?? "")))
      .filter(Boolean)

    const truePos = gotSkills.filter((s) => expectedSkills.includes(s)).length
    const recall = expectedSkills.length ? truePos / expectedSkills.length : 1
    const precision = gotSkills.length ? truePos / gotSkills.length : 1
    totalRecall += recall
    totalPrecision += precision

    const schemaValid = extractionStatus === "completed" && Array.isArray(payload.past_roles) && Array.isArray(payload.skills)
    if (schemaValid) schemaValidityCount += 1

    const roleAcc = String(payload.current_role ?? "") === String(fixture.expected.current_role ?? "")
    if (roleAcc) roleAccuracyCount += 1

    const gotYears = Number(payload.years_experience ?? NaN)
    const expectedYears = Number(fixture.expected.years_experience ?? NaN)
    const yearsAcc = Number.isFinite(gotYears) && Number.isFinite(expectedYears) && Math.abs(gotYears - expectedYears) <= 1
    if (yearsAcc) yearsAccuracyCount += 1

    const gotRoles = Array.isArray(payload.past_roles)
      ? (payload.past_roles as Array<{ title?: string; company?: string }>).map(
          (r) => `${r.title ?? ""}|${r.company ?? ""}`,
        )
      : []
    const expectedRoles = (fixture.expected.past_roles ?? []).map((r) => `${r.title ?? ""}|${r.company ?? ""}`)
    const hallucinated = gotRoles.filter((r) => !expectedRoles.includes(r)).length
    hallucinations += hallucinated

    rows.push(
      `| ${fixture.name} | ${schemaValid ? "1.00" : "0.00"} | ${recall.toFixed(2)} | ${precision.toFixed(2)} | ${
        roleAcc ? "1.00" : "0.00"
      } | ${yearsAcc ? "1.00" : "0.00"} | ${hallucinated} |`,
    )
  }

  const n = fixtures.length || 1
  rows.push(
    `| aggregate | ${(schemaValidityCount / n).toFixed(2)} | ${(totalRecall / n).toFixed(2)} | ${(
      totalPrecision / n
    ).toFixed(2)} | ${(roleAccuracyCount / n).toFixed(2)} | ${(yearsAccuracyCount / n).toFixed(
      2,
    )} | ${hallucinations} |`,
  )

  const reportPath = path.join(process.cwd(), "docs", "careeros", "module-1.2-quality-report.md")
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(
    reportPath,
    [
      "# Module 1.2 Quality Report",
      "",
      `Generated at: ${new Date().toISOString()}`,
      `Target: ${baseUrl}`,
      "",
      ...rows,
      "",
      "Notes:",
      "- Schema validity checks for completed extraction with expected top-level arrays.",
      "- Skill metrics use canonical_skill_key overlap.",
      "- Hallucinated roles count past roles absent from fixture expected.json.",
    ].join("\n"),
    "utf8",
  )

  for (const userId of createdUserIds) {
    await sb.auth.admin.deleteUser(userId)
  }
}

main()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Evaluation completed. Report written to docs/careeros/module-1.2-quality-report.md")
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
