import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId } = body

    console.log("[v0] Disconnect request for userId:", userId)

    if (!userId || typeof userId !== "string") {
      console.log("[v0] Invalid userId in disconnect request")
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    const session = chatStore.getSession(userId)

    if (!session) {
      console.log("[v0] No session found during disconnect for userId:", userId)
      return NextResponse.json({
        success: true,
        onlineCount: chatStore.getOnlineCount(),
      })
    }

    chatStore.deleteSession(userId)

    return NextResponse.json({
      success: true,
      onlineCount: chatStore.getOnlineCount(),
    })
  } catch (error) {
    console.error("[v0] Disconnect error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
