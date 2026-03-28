/* global chrome */
/** Idempotent: manifest + popup executeScript can both run; avoid duplicate top-level const. */
;(function junoJackJillPipe() {
  if (window.__junoJackJillPipeV1) return
  window.__junoJackJillPipeV1 = true

  /** Nav / chrome / J&J action bar — never use as company or role */
  const JJ_SKIP_LINE = (() => {
    const exact = new Set(
      [
        "home",
        "jobs",
        "profile",
        "new",
        "tracking",
        "archived",
        "search",
        "jack's brief",
        "search for roles",
        "update my preferences",
        "help with my cv",
        "not for me",
        "skip",
        "interested",
        "job post",
        "summary",
        "culture",
        "skills",
      ].map((s) => s.toLowerCase()),
    )
    return function skipLine(raw) {
      const s = raw
        .toLowerCase()
        .replace(/^[←→↓\s·|]+/u, "")
        .replace(/\s+/g, " ")
        .trim()
      if (!s) return true
      if (exact.has(s)) return true
      if (/^(not for me|skip|interested)$/i.test(s)) return true
      if (/^job post\b/i.test(s)) return true
      return false
    }
  })()

  function waitForContent(timeout = 10000) {
    return new Promise((resolve) => {
      const start = Date.now()
      const check = () => {
        const cards = document.querySelectorAll(
          '[data-testid*="job"], [class*="JobCard"], [class*="job-card"], [class*="opportunity"]',
        )
        if (cards.length > 0 || Date.now() - start > timeout) {
          resolve()
          return
        }
        requestAnimationFrame(check)
      }
      check()
    })
  }

  function sanitizeCardRoot(card) {
    const root = card.cloneNode(true)
    root.querySelectorAll("button, [role='button'], nav, footer").forEach((el) => el.remove())
    root
      .querySelectorAll(
        "[class*='bottom'], [class*='Bottom'], [class*='action'], [class*='ActionBar'], [class*='toolbar'], [class*='Toolbar']",
      )
      .forEach((el) => el.remove())
    return root
  }

  function scrubLines(lines) {
    const out = []
    for (const line of lines) {
      const t = line.trim()
      if (!t) continue
      if (JJ_SKIP_LINE(t)) continue
      out.push(t)
    }
    return out
  }

  function isPlausibleCompanyOrRole(s) {
    if (!s || s.length < 2 || s.length > 120) return false
    if (JJ_SKIP_LINE(s)) return false
    return /[a-zA-Z]/.test(s)
  }

  function extractJobCards() {
    const jobs = []

    const cardSelectors = [
      '[data-testid*="job"]',
      '[class*="JobCard"]',
      '[class*="job-card"]',
      '[class*="opportunity"]',
      '[class*="Opportunity"]',
      "main [class*='card']",
      "main section",
    ]

    let cards = []
    for (const selector of cardSelectors) {
      try {
        cards = Array.from(document.querySelectorAll(selector))
      } catch {
        continue
      }
      if (cards.length > 0) break
    }

    if (cards.length === 0) {
      cards = findCardsByContent()
    }

    const ranked = rankCardCandidates(cards)

    for (const card of ranked) {
      try {
        const job = extractFromCard(card)
        if (job && job.company && job.role && isPlausibleCompanyOrRole(job.company) && isPlausibleCompanyOrRole(job.role)) {
          jobs.push(job)
        }
      } catch (e) {
        console.warn("[Juno] Failed to extract card:", e)
      }
    }

    return dedupeJobsBySourceId(jobs)
  }

  function rankCardCandidates(nodes) {
    const scored = nodes
      .map((el) => {
        const clean = sanitizeCardRoot(el)
        const t = clean.innerText || ""
        const len = t.length
        let score = 0
        if (len < 120) score -= 100
        if (len > 12000) score -= 80
        if (/[\$£€][\d,]{3,}/.test(t)) score += 50
        if (/director|engineer|manager|lead|head|accounting|remote|hybrid/i.test(t)) score += 15
        if (/not for me/i.test(t) && len > 800) score -= 40
        score += Math.min(30, len / 200)
        return { el, score }
      })
      .filter((x) => x.score > -50)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) return nodes.slice(0, 3)
    return scored.map((s) => s.el)
  }

  function dedupeJobsBySourceId(jobs) {
    const seen = new Set()
    const out = []
    for (const j of jobs) {
      if (!j.sourceId || seen.has(j.sourceId)) continue
      seen.add(j.sourceId)
      out.push(j)
    }
    return out
  }

  function extractFromCard(card) {
    const clean = sanitizeCardRoot(card)
    const text = clean.innerText || clean.textContent || ""
    let lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    lines = scrubLines(lines)

    const links = clean.querySelectorAll("a[href]")

    const salaryMatch = text.match(
      /[\$£€][\d,]+(?:\s*[—–-]\s*[\$£€]?[\d,]+)?(?:\s*(?:USD|GBP|EUR))?/,
    )
    const locationMatch = text.match(
      /\b(Remote|Hybrid|On-?site|London|New York|San Francisco|Dublin|Berlin)\b/i,
    )

    let jobUrl = ""
    for (const link of links) {
      const href = link.getAttribute("href")
      if (
        href &&
        (href.includes("job") || href.includes("opportunity") || href.includes("posting"))
      ) {
        jobUrl = href.startsWith("http") ? href : `https://app.jackandjill.ai${href}`
        break
      }
    }

    const summaryItems = clean.querySelectorAll("li, [class*='summary'], [class*='bullet']")
    const summary = Array.from(summaryItems)
      .map((el) => el.textContent?.trim())
      .filter((s) => s && !JJ_SKIP_LINE(s))
      .join(". ")

    return {
      company: extractCompanyName(clean, lines),
      role: extractRoleTitle(clean, lines),
      location: locationMatch ? locationMatch[0] : "",
      salary: salaryMatch ? salaryMatch[0] : "",
      summary: summary || lines.slice(2, 6).join(". "),
      url: jobUrl,
      tags: extractTags(clean),
      rawText: text.substring(0, 1000),
      sourceId: generateSourceId(clean, lines, text),
    }
  }

  function extractCompanyName(card, lines) {
    const companyEl = card.querySelector(
      '[class*="company"], [class*="org"], [data-testid*="company"]',
    )
    if (companyEl) {
      const t = companyEl.textContent.trim()
      if (t && !JJ_SKIP_LINE(t)) return t.split("\n")[0].trim()
    }

    const heading = card.querySelector("h1, h2, h3, h4, [class*='title']:not([class*='subtitle'])")
    if (heading) {
      const t = heading.textContent.trim().split("\n")[0].trim()
      if (t && !JJ_SKIP_LINE(t)) return t
    }

    return lines[0] || ""
  }

  function extractRoleTitle(card, lines) {
    const roleEl = card.querySelector(
      '[class*="role"], [class*="position"], [class*="job-title"], [data-testid*="title"]',
    )
    if (roleEl) {
      const t = roleEl.textContent.trim()
      if (t && !JJ_SKIP_LINE(t)) return t
    }

    const subtitles = card.querySelectorAll("h2, h3, h4, h5, [class*='subtitle'], [class*='secondary']")
    for (const sub of subtitles) {
      const t = sub.textContent.trim()
      if (t && !JJ_SKIP_LINE(t) && t !== lines[0]) return t
    }

    return lines[1] || ""
  }

  function extractTags(card) {
    const tagEls = card.querySelectorAll(
      '[class*="tag"], [class*="badge"], [class*="chip"], [class*="pill"]',
    )
    return Array.from(tagEls)
      .map((el) => el.textContent.trim())
      .filter((s) => s && !JJ_SKIP_LINE(s))
  }

  function generateSourceId(card, lines, fullText) {
    const raw = (lines[0] || "") + (lines[1] || "") + (fullText || "").slice(0, 200)
    let hash = 0
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash |= 0
    }
    return `jj_${Math.abs(hash)}`
  }

  function findCardsByContent() {
    const allElements = document.querySelectorAll("main div, main section, article")
    const cards = []
    for (const el of allElements) {
      const t = el.textContent || ""
      if (t.match(/[\$£€][\d,]{3,}/) && t.length < 4000 && t.length > 150) {
        const childMatch = el.querySelector("div, section")
        if (!childMatch || !childMatch.textContent.match(/[\$£€][\d,]{3,}/)) {
          cards.push(el)
        }
      }
    }
    return cards
  }

  function observeNewCards() {
    const observer = new MutationObserver(() => {
      clearTimeout(window._junoRescrapeTimeout)
      window._junoRescrapeTimeout = setTimeout(() => {
        const newJobs = extractJobCards()
        if (newJobs.length > 0) {
          chrome.runtime.sendMessage({
            type: "NEW_JOBS",
            jobs: newJobs,
            scrapedAt: new Date().toISOString(),
            pageUrl: window.location.href,
          })
        }
      }, 1000)
    })

    const main = document.querySelector("main, [class*='content'], [class*='feed'], #root")
    if (main) {
      observer.observe(main, { childList: true, subtree: true })
    }
  }

  function scrapeAndSend() {
    return (async () => {
      await waitForContent()
      const jobs = extractJobCards()
      console.log(`[Juno] Found ${jobs.length} job cards`)
      if (jobs.length === 0) return { count: 0 }
      chrome.runtime.sendMessage({
        type: "NEW_JOBS",
        jobs,
        scrapedAt: new Date().toISOString(),
        pageUrl: window.location.href,
      })
      return { count: jobs.length }
    })()
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "JUNO_JJ_RESCAN") return
    scrapeAndSend()
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  })

  ;(async function run() {
    console.log("[Juno] Jack & Jill scraper loaded")
    await scrapeAndSend()
    observeNewCards()
  })()
})()
