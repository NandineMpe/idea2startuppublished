import { type NextRequest, NextResponse } from "next/server"

// In-memory store for demo; swap with DB in production
let feedbackStore: any[] = []

export async function GET() {
  return NextResponse.json({ feedback: feedbackStore })
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const newItem = {
    ...data,
    id: Date.now(),
    createdAt: new Date().toISOString(),
  }
  feedbackStore.unshift(newItem)
  return NextResponse.json({ success: true, item: newItem })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  feedbackStore = feedbackStore.filter((item) => item.id !== id)
  return NextResponse.json({ success: true })
}
