import { NextResponse } from "next/server"
import { testKvConnection, getKvInfo } from "@/lib/kv-debug"

export async function GET() {
  try {
    const connectionTest = await testKvConnection()
    const kvInfo = await getKvInfo()

    return NextResponse.json({
      connectionTest,
      kvInfo,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in KV test API:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
