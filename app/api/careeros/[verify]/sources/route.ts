import { NextResponse } from "next/server"
import { pingONet } from "@/lib/careeros/sources/onet"
import { pingCareerOneStop } from "@/lib/careeros/sources/careeronestop"
import { pingAdzuna } from "@/lib/careeros/sources/adzuna"
import { pingJSearch } from "@/lib/careeros/sources/jsearch"
import { pingBls } from "@/lib/careeros/sources/bls"
import { pingEurostat } from "@/lib/careeros/sources/eurostat"
import { pingCsoIreland } from "@/lib/careeros/sources/cso-ireland"
import { pingLevelsFyi } from "@/lib/careeros/sources/levelsfyi"
import { pingSecEdgar } from "@/lib/careeros/sources/sec-edgar"
import { pingArxiv } from "@/lib/careeros/sources/arxiv"
import { pingLayoffsFyi } from "@/lib/careeros/sources/layoffs-fyi"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type PingFn = () => Promise<unknown>

export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adapters: Array<[string, PingFn]> = [
    ["onet", pingONet],
    ["careeronestop", pingCareerOneStop],
    ["adzuna", pingAdzuna],
    ["jsearch", pingJSearch],
    ["bls", pingBls],
    ["eurostat", pingEurostat],
    ["cso-ireland", pingCsoIreland],
    ["levelsfyi", pingLevelsFyi],
    ["sec-edgar", pingSecEdgar],
    ["arxiv", pingArxiv],
    ["layoffs-fyi", pingLayoffsFyi],
  ]

  const results: Record<string, unknown> = {}
  for (const [name, ping] of adapters) {
    try {
      results[name] = await ping()
    } catch (err) {
      results[name] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  const allOk = Object.values(results).every((r) => {
    if (!r || typeof r !== "object") return false
    return (r as { ok?: unknown }).ok === true
  })

  return NextResponse.json({
    overall: allOk ? "PASS" : "FAIL",
    timestamp: new Date().toISOString(),
    adapters: results,
  })
}
