import { NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST() {
  try {
    const userId = crypto.randomUUID()

    if (!userId) {
      return NextResponse.json({ error: "Failed to generate user ID" }, { status: 500 })
    }

    chatStore.createSession(userId)

    return NextResponse.json({
      userId,
      onlineCount: chatStore.getOnlineCount(),
    })
  } catch (error) {
    console.error("[v0] Connect error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
