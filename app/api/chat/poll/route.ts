import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, lastMessageCount = 0 } = body

    console.log("[v0] Poll request - userId:", userId, "lastMessageCount:", lastMessageCount)

    if (!userId || typeof userId !== "string") {
      console.log("[v0] Invalid userId in poll request")
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    let session = chatStore.getSession(userId)
    if (!session) {
      console.log("[v0] Session not found, creating new session for userId:", userId)
      session = chatStore.createSession(userId)
    }

    // Check if partner disconnected
    let partnerDisconnected = false
    if (session.partnerId) {
      const partnerSession = chatStore.getSession(session.partnerId)
      if (!partnerSession || partnerSession.partnerId !== userId) {
        partnerDisconnected = true
        session.partnerId = null
      }
    }

    const validLastMessageCount = Math.max(0, Math.min(lastMessageCount, session.messages.length))
    const newMessages = session.messages.slice(validLastMessageCount)

    // Get partner typing status
    let isPartnerTyping = false
    if (session.partnerId) {
      const partnerSession = chatStore.getSession(session.partnerId)
      isPartnerTyping = partnerSession?.isTyping || false
    }

    const response = {
      messages: newMessages,
      isPartnerTyping,
      partnerDisconnected,
      hasPartner: !!session.partnerId,
      onlineCount: chatStore.getOnlineCount(),
    }

    console.log("[v0] Poll response:", response)

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Poll error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
