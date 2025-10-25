import { type NextRequest, NextResponse } from "next/server"
import { chatStore } from "@/lib/chat-store"

function filterMessage(content: string): string {
  const patterns = [
    /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g,
    /\d{3}[-\s]?\d{4}[-\s]?\d{4}/g,
    /\d{2,3}-?\d{3,4}-?\d{4}/g,
    /\+\d{1,3}[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{1,9}/g,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    /@[a-zA-Z0-9_]{3,}/g,
    /카톡|카카오톡|카카오|라인|텔레그램|텔레|인스타그램|인스타|페이스북|페북|트위터|디스코드/gi,
    /kakao|kakaotalk|line|telegram|instagram|insta|facebook|twitter|discord|snapchat|whatsapp/gi,
    /https?:\/\/[^\s]+/g,
    /www\.[^\s]+/g,
    /아이디|ID|id|계정|연락처|번호/gi,
  ]

  let filtered = content
  patterns.forEach((pattern) => {
    filtered = filtered.replace(pattern, "[차단됨]")
  })

  return filtered
}

export async function POST(req: NextRequest) {
  const { userId, content } = await req.json()

  const session = chatStore.getSession(userId)
  if (!session || !session.partnerId) {
    return NextResponse.json({ error: "No active chat" }, { status: 400 })
  }

  const filtered = filterMessage(content)

  // Add message to both user's and partner's session
  chatStore.addMessage(userId, filtered, "user")
  chatStore.addMessage(session.partnerId, filtered, "partner")

  return NextResponse.json({ success: true })
}
