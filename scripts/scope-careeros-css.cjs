const fs = require("fs")
const path = require("path")

const inPath = path.join(__dirname, "../app/careeros-prototype.css")
const css = fs.readFileSync(inPath, "utf8")
const chromeStart = css.indexOf("/* ---- chrome ---- */")
if (chromeStart < 0) throw new Error("chrome section not found")

const header = `/* CareerOS chrome — scoped; uses Juno emerald + white from globals.css */
.career-os-shell {
  --status-rising: 160 84% 39%;
  --status-stable: 199 89% 48%;
  --status-declining: 38 92% 50%;
  --status-risk: 0 84% 60%;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

`

let body = css.slice(chromeStart)
// Drop lane-switcher block (removed from UI)
body = body.replace(/\/\*[\s\S]*?\.lane-btn\[data-lane="career"\][\s\S]*?\n\n/, "")

function prefixSelectors(chunk) {
  return chunk.replace(/(^|\n)(\.[a-zA-Z][\w-]*)/g, "$1.career-os-shell $2")
}

body = prefixSelectors(body)
body = body.replace(/\.career-os-shell \.career-os-/g, ".career-os-")
body = body.replace(/font-family: 'Fraunces', Georgia, serif;\s*font-style: italic;\s*/g, "")
body = body.replace(
  /background: linear-gradient\(135deg, hsl\(152 26% 50%\), hsl\(168 30% 45%\)\);/,
  "background: linear-gradient(135deg, hsl(160 84% 45%), hsl(161 94% 35%));",
)
body = body.replace(/\.sage-halo/g, ".juno-halo")
body = body.replace(
  /\.juno-halo \{[\s\S]*?\}/,
  `.juno-halo {
  background:
    radial-gradient(70% 80% at 90% 10%, hsl(160 84% 39% / 0.06), transparent 60%),
    radial-gradient(60% 70% at 0% 100%, hsl(152 81% 96% / 0.5), transparent 60%);
}`,
)
body = body.replace(
  /box-shadow: 0 1px 2px hsl\(25 15% 18% \/ 0\.06\);/,
  "box-shadow: 0 1px 2px hsl(222 47% 11% / 0.06);",
)

fs.writeFileSync(inPath, header + body)
console.log("scoped", inPath)
