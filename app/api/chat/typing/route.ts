import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  const { userId, isTyping } = await req.json()

  let session = chatStore.getSession(userId)
  if (!session) {
    console.log("[v0] Session not found, creating new session for userId:", userId)
    session = chatStore.createSession(userId)
  }

  chatStore.setTyping(userId, isTyping)

  return NextResponse.json({
    success: true,
    onlineCount: chatStore.getOnlineCount(),
  })
}
