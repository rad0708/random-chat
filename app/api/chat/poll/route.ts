import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  const { userId, lastMessageCount = 0 } = await req.json()

  const session = chatStore.getSession(userId)
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
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

  // Get new messages
  const newMessages = session.messages.slice(lastMessageCount)

  // Get partner typing status
  let isPartnerTyping = false
  if (session.partnerId) {
    const partnerSession = chatStore.getSession(session.partnerId)
    isPartnerTyping = partnerSession?.isTyping || false
  }

  return NextResponse.json({
    messages: newMessages,
    isPartnerTyping,
    partnerDisconnected,
    hasPartner: !!session.partnerId,
    onlineCount: chatStore.getOnlineCount(),
  })
}
