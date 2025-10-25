import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

export async function POST(req: NextRequest) {
  const { userId } = await req.json()

  chatStore.deleteSession(userId)

  return NextResponse.json({ success: true })
}
