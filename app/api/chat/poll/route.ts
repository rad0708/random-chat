import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, lastMessageCount = 0 } = body

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    let session = chatStore.getSession(userId)
    if (!session) {
      session = chatStore.createSession(userId)
    }

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

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Poll error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
