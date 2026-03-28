document.addEventListener("DOMContentLoaded", async () => {
  const config = await chrome.storage.local.get(["juno_api_key", "juno_url", "last_sync"])
  if (config.juno_api_key) {
    document.getElementById("apiKey").value = config.juno_api_key
  }
  if (config.juno_url) {
    document.getElementById("junoUrl").value = config.juno_url
  }
  if (config.last_sync) {
    const ago = timeSince(new Date(config.last_sync))
    const el = document.getElementById("status")
    el.textContent = `Last J&J sync: ${ago}`
    el.className = "status status-ok"
  }

  document.getElementById("saveBtn").addEventListener("click", async () => {
    const apiKey = document.getElementById("apiKey").value.trim()
    const junoUrl = document.getElementById("junoUrl").value.trim()

    await chrome.storage.local.set({
      juno_api_key: apiKey,
      juno_url: junoUrl,
    })

    const el = document.getElementById("status")
    el.textContent = "Settings saved!"
    el.className = "status status-ok"
  })

  document.getElementById("scanBtn").addEventListener("click", () => void runScan("jackjill"))

  document.getElementById("scanApolloBtn").addEventListener("click", () => void runScan("apollo"))
})

async function runScan(kind) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const el = document.getElementById("status")
  if (!tab?.id || !tab.url) {
    el.textContent = "No active tab."
    el.className = "status status-err"
    return
  }

  const file = kind === "apollo" ? "content-apollo.js" : "content-jackjill.js"
  const okUrl =
    kind === "apollo"
      ? tab.url.includes("apollo.io")
      : tab.url.includes("jackandjill.ai")

  if (!okUrl) {
    el.textContent =
      kind === "apollo"
        ? "Open an Apollo.io people search results page first."
        : "Open Jack & Jill jobs dashboard first."
    el.className = "status status-err"
    return
  }

  try {
    if (kind === "jackjill") {
      try {
        const r = await chrome.tabs.sendMessage(tab.id, { type: "JUNO_JJ_RESCAN" })
        if (r?.ok === false) throw new Error(r.error || "Rescan failed")
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [file],
        })
      }
    } else {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [file],
      })
    }
    el.textContent =
      kind === "apollo"
        ? "Apollo scan ran — check console. Open Juno → GTM to merge matches."
        : "Jack & Jill scan triggered — check console and Juno."
    el.className = "status status-ok"
  } catch (e) {
    el.textContent = `Could not scan: ${e?.message || e}`
    el.className = "status status-err"
  }
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  return `${Math.floor(seconds / 86400)} days ago`
}
