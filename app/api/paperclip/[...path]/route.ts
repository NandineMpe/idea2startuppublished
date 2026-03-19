import { NextRequest, NextResponse } from "next/server"

const PAPERCLIP_URL = process.env.PAPERCLIP_URL || "http://localhost:3100"

async function proxyRequest(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/paperclip", "/api")
  const url = `${PAPERCLIP_URL}${path}${request.nextUrl.search}`

  const headers = new Headers()
  headers.set("Content-Type", "application/json")
  const authHeader = request.headers.get("Authorization")
  if (authHeader) {
    headers.set("Authorization", authHeader)
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      const body = await request.text()
      if (body) init.body = body
    } catch {
      // no body
    }
  }

  try {
    const response = await fetch(url, init)
    const data = await response.text()

    return new NextResponse(data, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
    })
  } catch {
    return NextResponse.json(
      { error: "Paperclip service unavailable", details: "Could not connect to Paperclip at " + PAPERCLIP_URL },
      { status: 503 }
    )
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request)
}

export async function POST(request: NextRequest) {
  return proxyRequest(request)
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request)
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request)
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request)
}
