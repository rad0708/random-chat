import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  const { userId } = await req.json()

  console.log("[v0] Disconnect request for userId:", userId)

  const session = chatStore.getSession(userId)

  if (!session) {
    console.log("[v0] No session found during disconnect for userId:", userId)
    return NextResponse.json({
      success: true,
      onlineCount: chatStore.getOnlineCount(),
    })
  }

  // This ensures the user is immediately removed from online count
  chatStore.deleteSession(userId)

  return NextResponse.json({
    success: true,
    onlineCount: chatStore.getOnlineCount(),
  })
}
