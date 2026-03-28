/* global chrome */
;(function () {
  if (!/\/dashboard\/distribution/.test(location.pathname)) return

  const KEY = "juno-distribution-v1"

  function injectApolloMatches(matches) {
    if (!Array.isArray(matches) || matches.length === 0) return
    const payload = JSON.stringify(matches)
    const el = document.createElement("script")
    el.textContent = `window.dispatchEvent(new CustomEvent("junoDistributionApolloMatches",{detail:${payload}}));`
    ;(document.head || document.documentElement).appendChild(el)
    el.remove()
  }

  function syncPlaybook() {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        chrome.runtime.sendMessage({ type: "JUNO_PLAYBOOK_SYNC", rawJson: raw })
      }
    } catch (e) {
      console.warn("[Juno] playbook sync failed", e)
    }
  }

  syncPlaybook()

  chrome.runtime.sendMessage({ type: "REQUEST_PENDING_MATCHES" }, (resp) => {
    if (chrome.runtime.lastError) return
    if (resp && Array.isArray(resp.matches) && resp.matches.length > 0) {
      injectApolloMatches(resp.matches)
    }
  })
})()
