import { NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST() {
  const userId = crypto.randomUUID()
  chatStore.createSession(userId)

  return NextResponse.json({
    userId,
    onlineCount: chatStore.getOnlineCount(),
  })
}
