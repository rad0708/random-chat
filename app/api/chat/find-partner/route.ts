import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  const { userId } = await req.json()

  const session = chatStore.getSession(userId)
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Disconnect current partner if any
  if (session.partnerId) {
    chatStore.disconnectPartner(userId)
  }

  // Try to find a match
  const partnerId = chatStore.findMatch(userId)

  if (partnerId) {
    chatStore.connectPartners(userId, partnerId)
    return NextResponse.json({ status: "matched", partnerId })
  }

  return NextResponse.json({ status: "waiting" })
}
