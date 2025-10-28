import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId } = body

    console.log("[v0] Find partner request for userId:", userId)

    if (!userId || typeof userId !== "string") {
      console.log("[v0] Invalid userId in find partner request")
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    let session = chatStore.getSession(userId)
    if (!session) {
      console.log("[v0] Session not found, creating new session for userId:", userId)
      session = chatStore.createSession(userId)
    }

    // Disconnect current partner if any
    if (session.partnerId) {
      chatStore.disconnectPartner(userId)
    }

    // Try to find a match
    const partnerId = chatStore.findMatch(userId)
    console.log("[v0] Match result - partnerId:", partnerId)

    if (partnerId) {
      chatStore.connectPartners(userId, partnerId)
      return NextResponse.json({
        status: "matched",
        partnerId,
        onlineCount: chatStore.getOnlineCount(),
      })
    }

    return NextResponse.json({
      status: "waiting",
      onlineCount: chatStore.getOnlineCount(),
    })
  } catch (error) {
    console.error("[v0] Find partner error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
