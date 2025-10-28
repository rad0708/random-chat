"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History, Trash2 } from "lucide-react"

type ChatSession = {
  id: string
  startTime: string
  endTime: string
  messageCount: number
  duration: number
}

export function ChatHistoryDialog() {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<ChatSession[]>([])

  useEffect(() => {
    const saved = localStorage.getItem("chat-history")
    if (saved) {
      setHistory(JSON.parse(saved))
    }
  }, [open])

  const clearHistory = () => {
    localStorage.removeItem("chat-history")
    setHistory([])
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}분 ${secs}초`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <History className="w-4 h-4" />
          <span className="sr-only">채팅 기록</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>채팅 기록</DialogTitle>
          <DialogDescription>최근 채팅 세션 기록</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <History className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">채팅 기록이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((session) => (
                <div key={session.id} className="border border-border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{formatDate(session.startTime)}</span>
                    <span className="text-xs text-muted-foreground">{formatDuration(session.duration)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{session.messageCount}개의 메시지</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {history.length > 0 && (
          <Button variant="outline" onClick={clearHistory} className="w-full gap-2 bg-transparent">
            <Trash2 className="w-4 h-4" />
            기록 삭제
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function saveChatSession(messageCount: number, duration: number) {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    startTime: new Date(Date.now() - duration * 1000).toISOString(),
    endTime: new Date().toISOString(),
    messageCount,
    duration,
  }

  const saved = localStorage.getItem("chat-history")
  const history: ChatSession[] = saved ? JSON.parse(saved) : []
  history.unshift(session)

  // Keep only last 20 sessions
  if (history.length > 20) {
    history.pop()
  }

  localStorage.setItem("chat-history", JSON.stringify(history))
}
