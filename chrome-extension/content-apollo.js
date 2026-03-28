/* global chrome */
;(async function () {
  console.log("[Juno] Apollo scraper loaded")

  await waitForApolloRows()

  const contacts = extractApolloContacts()
  console.log(`[Juno] Apollo: extracted ${contacts.length} contacts`)

  if (contacts.length === 0) return

  chrome.runtime.sendMessage({
    type: "APOLLO_CONTACTS",
    contacts,
    scrapedAt: new Date().toISOString(),
    pageUrl: window.location.href,
  })
})()

function waitForApolloRows(timeout = 12000) {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      if (findLinkedInPeopleLinks().length > 0 || Date.now() - start > timeout) {
        resolve()
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })
}

function findLinkedInPeopleLinks() {
  return Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]')).filter((a) => {
    const href = (a.getAttribute("href") || "").split("?")[0]
    return /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(href) || /linkedin\.com\/in\/[^/?#]+/i.test(href)
  })
}

function splitName(full) {
  const p = full.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return { firstName: "", lastName: "" }
  if (p.length === 1) return { firstName: p[0], lastName: "" }
  return { firstName: p[0], lastName: p.slice(1).join(" ") }
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

function extractApolloContacts() {
  const links = findLinkedInPeopleLinks()
  const seen = new Set()
  const contacts = []

  for (const a of links) {
    const linkedinUrl = (a.href || "").split("?")[0].split("#")[0]
    if (!linkedinUrl || seen.has(linkedinUrl)) continue

    const nameText = (a.innerText || a.textContent || "").trim().replace(/\s+/g, " ")
    if (!nameText || nameText.length > 100) continue

    const row =
      a.closest("tr") ||
      a.closest('[role="row"]') ||
      a.closest("[data-row-key]") ||
      a.closest("li") ||
      a.closest('[class*="TableRow"]') ||
      a.closest('[class*="table-row"]') ||
      a.closest("article") ||
      a.parentElement?.parentElement?.parentElement

    if (!row) continue

    const clone = row.cloneNode(true)
    clone.querySelectorAll("button, [role='button']").forEach((el) => el.remove())
    const lines = (clone.innerText || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)

    const { firstName, lastName } = splitName(nameText)

    let title = ""
    let company = ""
    let location = ""

    const nameIdx = lines.findIndex((l) => l === nameText || l.startsWith(firstName))
    if (nameIdx >= 0) {
      title = lines[nameIdx + 1] || ""
      company = lines[nameIdx + 2] || ""
      location = lines[nameIdx + 3] || ""
    }

    if (!title && lines.length >= 2) {
      const second = lines.find((l) => l !== nameText && l.length > 2 && l.length < 120)
      if (second) title = second
    }
    if (!company && lines.length >= 3) {
      const third = lines.find((l) => l !== nameText && l !== title && l.length < 120)
      if (third) company = third
    }

    if (!company) company = "Unknown"
    if (!title) title = "—"

    if (/^view\b/i.test(company) || /^show\b/i.test(company)) company = lines.find((l) => l.length > 2) || "Unknown"

    seen.add(linkedinUrl)
    contacts.push({
      firstName,
      lastName,
      company,
      role: title,
      title,
      location: location && location.length < 120 ? location : "",
      linkedinUrl,
      sourceId: `apollo_${hashStr(linkedinUrl)}`,
    })
  }

  return dedupeByLinkedin(contacts)
}

function dedupeByLinkedin(list) {
  const m = new Map()
  for (const c of list) {
    if (!m.has(c.linkedinUrl)) m.set(c.linkedinUrl, c)
  }
  return [...m.values()]
}
