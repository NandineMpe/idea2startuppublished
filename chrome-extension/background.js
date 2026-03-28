const DEFAULT_JUNO_URL = "https://idea2startuppublished.vercel.app"
const SEEN_JOBS_KEY = "juno_seen_jobs"
/** Must match `MAX_JOBS_PER_REQUEST` in `app/api/leads/import/route.ts` */
const CHUNK_SIZE = 5
/** Must match `MAX_APOLLO_DISTRIBUTION_LEADS_PER_REQUEST` */
const APOLLO_CHUNK = 12

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "NEW_JOBS") {
    handleNewJobs(message.jobs).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: String(e) }),
    )
    return true
  }
  if (message.type === "APOLLO_CONTACTS") {
    handleApolloContacts(message.contacts).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: String(e) }),
    )
    return true
  }
  if (message.type === "JUNO_PLAYBOOK_SYNC") {
    ;(async () => {
      try {
        const parsed = JSON.parse(message.rawJson)
        const profile = {
          rationale: String(parsed.rationale ?? ""),
          multiplierNote: String(parsed.convertedLead?.multiplierNote ?? ""),
          pitchAngle: String(parsed.pitchAngle ?? ""),
          templates: {
            inmail: String(parsed.templates?.inmail ?? ""),
            coldEmail: String(parsed.templates?.coldEmail ?? ""),
          },
        }
        await chrome.storage.local.set({ juno_distribution_playbook: profile, juno_playbook_synced_at: new Date().toISOString() })
        sendResponse({ ok: true })
      } catch (e) {
        sendResponse({ ok: false, error: String(e) })
      }
    })()
    return true
  }
  if (message.type === "REQUEST_PENDING_MATCHES") {
    ;(async () => {
      const data = await chrome.storage.local.get("juno_pending_distribution_matches")
      const matches = data.juno_pending_distribution_matches || []
      await chrome.storage.local.remove("juno_pending_distribution_matches")
      sendResponse({ matches })
    })()
    return true
  }
})

async function handleNewJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) return

  const storage = await chrome.storage.local.get(SEEN_JOBS_KEY)
  const seen = new Set(storage[SEEN_JOBS_KEY] || [])

  const newJobs = jobs.filter((job) => job.sourceId && !seen.has(job.sourceId))
  if (newJobs.length === 0) {
    console.log("[Juno] No new jobs to send")
    return
  }

  const config = await chrome.storage.local.get(["juno_api_key", "juno_url"])
  if (!config.juno_api_key) {
    console.warn("[Juno] No API key configured. Open extension popup to set it.")
    return
  }

  const base = String(config.juno_url || DEFAULT_JUNO_URL).replace(/\/$/, "")

  let totalImported = 0
  for (let i = 0; i < newJobs.length; i += CHUNK_SIZE) {
    const chunk = newJobs.slice(i, i + CHUNK_SIZE)
    const res = await fetch(`${base}/api/leads/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.juno_api_key}`,
      },
      body: JSON.stringify({
        source: "jack_and_jill",
        jobs: chunk,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error(`[Juno] API error: ${res.status}`, errText)
      chrome.action.setBadgeText({ text: "!" })
      chrome.action.setBadgeBackgroundColor({ color: "#E24B4A" })
      throw new Error(`HTTP ${res.status}`)
    }

    const result = await res.json().catch(() => ({}))
    totalImported += result.imported ?? chunk.length

    for (const job of chunk) {
      if (job.sourceId) seen.add(job.sourceId)
    }
  }

  const seenArray = [...seen].slice(-5000)
  await chrome.storage.local.set({
    [SEEN_JOBS_KEY]: seenArray,
    last_sync: new Date().toISOString(),
  })

  console.log(`[Juno] Imported ${totalImported} lead(s)`)

  chrome.action.setBadgeText({ text: String(Math.min(totalImported, 99)) })
  chrome.action.setBadgeBackgroundColor({ color: "#1D9E75" })
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000)
}

function hashKey(s) {
  const str = String(s)
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

async function handleApolloContacts(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return

  const config = await chrome.storage.local.get(["juno_api_key", "juno_url", "juno_distribution_playbook"])
  if (!config.juno_api_key) {
    console.warn("[Juno] No API key — set Juno import secret in the extension popup.")
    return
  }

  const playbook = config.juno_distribution_playbook
  if (!playbook?.pitchAngle || !playbook?.rationale || !playbook?.templates?.inmail || !playbook?.templates?.coldEmail) {
        console.warn("[Juno] Open Juno → GTM (lookalike) in this browser so the playbook syncs, then re-run Apollo.")
    chrome.action.setBadgeText({ text: "P" })
    chrome.action.setBadgeBackgroundColor({ color: "#F59E0B" })
    return
  }

  const base = String(config.juno_url || DEFAULT_JUNO_URL).replace(/\/$/, "")

  const jobs = contacts.map((c) => ({
    company: c.company,
    role: c.role || c.title || "—",
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    location: c.location || "",
    linkedinUrl: c.linkedinUrl,
    sourceId: c.sourceId,
  }))

  const allMatches = []

  for (let i = 0; i < jobs.length; i += APOLLO_CHUNK) {
    const chunk = jobs.slice(i, i + APOLLO_CHUNK)
    const res = await fetch(`${base}/api/leads/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.juno_api_key}`,
      },
      body: JSON.stringify({
        source: "apollo_extension",
        distribution: true,
        conversionProfile: playbook,
        jobs: chunk,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error(`[Juno] Apollo import error: ${res.status}`, errText)
      chrome.action.setBadgeText({ text: "!" })
      chrome.action.setBadgeBackgroundColor({ color: "#E24B4A" })
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json().catch(() => ({}))
    for (const r of data.results || []) {
      const idKey = r.linkedinUrl || `${r.firstName}|${r.lastName}|${r.company}`
      allMatches.push({
        id: `m-apollo-${hashKey(idKey)}`,
        firstName: r.firstName,
        lastName: r.lastName,
        title: r.role,
        company: r.company,
        location: r.location || "",
        fitScore: typeof r.fitScore === "number" ? r.fitScore : 82,
        sent: false,
        personalizedInmail: r.personalizedInmail,
        personalizedEmail: r.personalizedEmail,
      })
    }
  }

  await chrome.storage.local.set({
    juno_pending_distribution_matches: allMatches,
    juno_apollo_import_at: new Date().toISOString(),
  })

  console.log(`[Juno] Apollo → ${allMatches.length} personalized rows queued. Open Juno → GTM to merge into Matches.`)

  chrome.action.setBadgeText({ text: String(Math.min(allMatches.length, 99)) })
  chrome.action.setBadgeBackgroundColor({ color: "#6366F1" })
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 8000)
}
