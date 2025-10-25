import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  const { userId, isTyping } = await req.json()

  const session = chatStore.getSession(userId)
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  chatStore.setTyping(userId, isTyping)

  return NextResponse.json({ success: true })
}
