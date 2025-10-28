import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  const { userId } = await req.json()

  let session = chatStore.getSession(userId)
  if (!session) {
    console.log("[v0] Session not found during disconnect, creating for userId:", userId)
    session = chatStore.createSession(userId)
  }

  if (session.partnerId) {
    chatStore.disconnectPartner(userId)
  }

  return NextResponse.json({
    success: true,
    onlineCount: chatStore.getOnlineCount(),
  })
}
