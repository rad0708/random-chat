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

    if (session.partnerId) {
      console.log(
        "[v0] User already has a partner, disconnecting first. userId:",
        userId,
        "partnerId:",
        session.partnerId,
      )
      chatStore.disconnectPartner(userId)
    }

    // Try to find a match
    const partnerId = chatStore.findMatch(userId)
    console.log("[v0] Match result - userId:", userId, "partnerId:", partnerId)

    if (partnerId) {
      if (partnerId === userId) {
        console.error("[v0] ERROR: Attempted to match user with themselves! userId:", userId)
        return NextResponse.json({
          status: "waiting",
          onlineCount: chatStore.getOnlineCount(),
        })
      }

      chatStore.connectPartners(userId, partnerId)

      const updatedSession = chatStore.getSession(userId)
      if (updatedSession?.partnerId === userId) {
        console.error("[v0] ERROR: Self-connection detected after connectPartners! userId:", userId)
        chatStore.disconnectPartner(userId)
        return NextResponse.json({
          status: "waiting",
          onlineCount: chatStore.getOnlineCount(),
        })
      }

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
