import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, isTyping } = body

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    if (typeof isTyping !== "boolean") {
      return NextResponse.json({ error: "Invalid isTyping value" }, { status: 400 })
    }

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
  } catch (error) {
    console.error("[v0] Typing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
