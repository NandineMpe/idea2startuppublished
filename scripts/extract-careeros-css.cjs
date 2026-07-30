const fs = require("fs")
const path = require("path")

const htmlPath = path.join(__dirname, "../design/juno-ai/project/CareerOS Prototype.html")
const outPath = path.join(__dirname, "../app/careeros-prototype.css")

const html = fs.readFileSync(htmlPath, "utf8")
const m = html.match(/<style>([\s\S]*?)<\/style>/)
if (!m) throw new Error("no style block")

let css = m[1]
// Drop voice-mode block; keep tabs/meter/row at end
const voiceStart = css.indexOf("/* ============== VOICE MODE")
const tableStart = css.indexOf("/* table-like rows */")
if (voiceStart >= 0 && tableStart > voiceStart) {
  css = css.slice(0, voiceStart) + css.slice(tableStart)
}

const header = `/* CareerOS layout — run scope-careeros-css.cjs after extract */\n`

const scoped = css.replace(/^  /gm, "")
const statusRoot = `
:root {
  --status-rising: 152 26% 40%;
  --status-stable: 217 35% 50%;
  --status-declining: 32 60% 48%;
  --status-risk: 5 60% 50%;
  --lane-emerald: 152 26% 40%;
  --lane-emerald-soft: 152 26% 94%;
  --lane-blue: 217 50% 50%;
  --lane-violet: 268 45% 55%;
}
.dark {
  --status-rising: 152 30% 58%;
  --status-stable: 217 40% 65%;
  --status-declining: 32 60% 60%;
  --status-risk: 5 60% 62%;
  --lane-emerald-soft: 152 26% 18%;
}
`

fs.writeFileSync(outPath, header + statusRoot + "\n" + scoped)
console.log("wrote", outPath, fs.statSync(outPath).size, "bytes")
