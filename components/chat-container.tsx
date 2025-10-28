"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ChatClient, type ChatStatus } from "@/lib/chat-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { ReportDialog } from "@/components/report-dialog"
import { SettingsDialog, useSettings } from "@/components/settings-dialog"
import { containsProfanity, isSpam } from "@/lib/profanity-filter"
import { SoundManager } from "@/lib/sound-manager"
import { Send, SkipForward, Loader2, CheckCheck, AlertCircle, X, Wifi, WifiOff, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type ChatMessage = {
  id: string
  content: string
  sender: "user" | "partner" | "system"
  timestamp: string
  status?: "sending" | "sent" | "failed"
}

const MAX_MESSAGE_LENGTH = 500
const MESSAGE_COOLDOWN = 1000

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [chatState, setChatState] = useState<ChatStatus>("disconnected")
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatDuration, setChatDuration] = useState(0)
  const [lastMessageTime, setLastMessageTime] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [userConnectionQuality, setUserConnectionQuality] = useState<"good" | "poor" | "disconnected">("disconnected")
  const [partnerDisconnected, setPartnerDisconnected] = useState(false)

  const clientRef = useRef<ChatClient | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const chatStartTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<NodeJS.Timeout>()
  const soundManagerRef = useRef<SoundManager>(new SoundManager())
  const messageIdsRef = useRef<Set<string>>(new Set())
  const lastPollTimeRef = useRef<number>(Date.now())
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout>()

  const { toast } = useToast()
  const settings = useSettings()

  useEffect(() => {
    soundManagerRef.current.setEnabled(settings.soundEnabled)
  }, [settings.soundEnabled])

  useEffect(() => {
    connectionCheckIntervalRef.current = setInterval(() => {
      if (!clientRef.current?.isReady()) {
        setUserConnectionQuality("disconnected")
        return
      }

      const timeSinceLastPoll = Date.now() - lastPollTimeRef.current
      if (timeSinceLastPoll > 10000) {
        setUserConnectionQuality("disconnected")
      } else if (timeSinceLastPoll > 5000) {
        setUserConnectionQuality("poor")
      } else {
        setUserConnectionQuality("good")
      }
    }, 3000)

    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      setIsAtBottom(isBottom)
      if (isBottom) {
        setUnreadCount(0)
      }
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    setIsMounted(true)

    const client = new ChatClient(
      (status) => {
        console.log("[v0] Chat status changed:", status)
        setChatState(status)

        if (status === "chatting") {
          setMessages([])
          messageIdsRef.current.clear()
          setChatDuration(0)
          chatStartTimeRef.current = Date.now()
          setPartnerDisconnected(false)

          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = setInterval(() => {
            setChatDuration(Math.floor((Date.now() - chatStartTimeRef.current) / 1000))
          }, 1000)

          addSystemMessage("상대와 연결되었습니다!")
          soundManagerRef.current.playConnectSound()
        }

        if (status === "disconnected") {
          setUserConnectionQuality("disconnected")
        } else {
          setUserConnectionQuality("good")
        }
      },
      (newMessages) => {
        lastPollTimeRef.current = Date.now()
        newMessages.forEach((msg) => {
          const messageId = `${msg.sender}-${msg.timestamp}-${msg.content}`

          if (!messageIdsRef.current.has(messageId)) {
            messageIdsRef.current.add(messageId)
            if (msg.sender === "partner") {
              addMessage(msg.content, msg.sender, msg.timestamp, "sent")
              soundManagerRef.current.playMessageSound()
              if (!isAtBottom) {
                setUnreadCount((prev) => prev + 1)
              }
            }
          }
        })
      },
      (isTyping) => {
        setIsPartnerTyping(isTyping)
      },
      (count) => {
        setOnlineCount(count)
      },
      () => {
        console.log("[v0] Partner disconnected callback triggered")
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = undefined
        }
        addSystemMessage("상대가 대화를 종료했습니다.")
        soundManagerRef.current.playDisconnectSound()
        setChatDuration(0)
        setPartnerDisconnected(true)
        setChatState("disconnected")
      },
      (error) => {
        console.log("[v0] Chat error:", error)
        toast({
          title: "오류",
          description: error,
          variant: "destructive",
        })
      },
    )

    clientRef.current = client
    client.connect()

    const handleBeforeUnload = () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && clientRef.current) {
        const userId = clientRef.current.getUserId()
        if (userId) {
          navigator.sendBeacon("/api/chat/disconnect", JSON.stringify({ userId }))
        }
      }
    }

    const handlePageHide = () => {
      const userId = clientRef.current?.getUserId()
      if (userId) {
        navigator.sendBeacon("/api/chat/disconnect", JSON.stringify({ userId }))
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      client.disconnect()
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = undefined
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = undefined
      }
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current)
        connectionCheckIntervalRef.current = undefined
      }
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [])

  useEffect(() => {
    if (isAtBottom && isMounted) {
      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      }

      const timer = setTimeout(scrollToBottom, 100)
      return () => clearTimeout(timer)
    }
  }, [messages, isPartnerTyping, isAtBottom, isMounted])

  const addMessage = (
    content: string,
    sender: "user" | "partner" | "system",
    timestamp?: string,
    status?: "sending" | "sent" | "failed",
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        content,
        sender,
        timestamp: timestamp || new Date().toISOString(),
        status,
      },
    ])
  }

  const addSystemMessage = (content: string) => {
    addMessage(content, "system")
  }

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim()) return

    if (chatState !== "chatting") {
      toast({
        title: "메시지를 보낼 수 없습니다",
        description: "채팅 상대가 연결되지 않았습니다.",
        variant: "destructive",
      })
      return
    }

    const now = Date.now()
    if (now - lastMessageTime < MESSAGE_COOLDOWN) {
      toast({
        title: "메시지를 천천히 보내주세요",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      return
    }

    if (inputValue.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "메시지가 너무 깁니다",
        description: `최대 ${MAX_MESSAGE_LENGTH}자까지 입력 가능합니다.`,
        variant: "destructive",
      })
      return
    }

    if (containsProfanity(inputValue)) {
      toast({
        title: "메시지를 보낼 수 없습니다",
        description: "부적절한 언어가 포함되어 있습니다.",
        variant: "destructive",
      })
      return
    }

    if (isSpam(inputValue)) {
      toast({
        title: "메시지를 보낼 수 없습니다",
        description: "스팸으로 감지되었습니다.",
        variant: "destructive",
      })
      return
    }

    const messageContent = inputValue
    const messageId = `user-${new Date().toISOString()}-${messageContent}`

    setInputValue("")
    setLastMessageTime(now)

    messageIdsRef.current.add(messageId)
    addMessage(messageContent, "user", undefined, "sending")

    clientRef.current?.sendMessage(messageContent).then((success) => {
      if (success !== false) {
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) => (msg.status === "sending" ? { ...msg, status: "sent" as const } : msg)),
          )
        }, 500)
      } else {
        setMessages((prev) =>
          prev.map((msg) => (msg.status === "sending" ? { ...msg, status: "failed" as const } : msg)),
        )
      }
    })

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = undefined
    }
    if (settings.showTypingIndicator) {
      clientRef.current?.sendTyping(false)
    }
  }, [inputValue, chatState, lastMessageTime, settings.showTypingIndicator, toast])

  const handleInputChange = (value: string) => {
    setInputValue(value)

    if (chatState === "chatting" && settings.showTypingIndicator) {
      clientRef.current?.sendTyping(true)

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        clientRef.current?.sendTyping(false)
      }, 1000)
    }
  }

  const handleStartChat = () => {
    if (chatState !== "disconnected") {
      return
    }
    setPartnerDisconnected(false)
    clientRef.current?.findPartner()
  }

  const handleNext = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = undefined
    }
    setChatDuration(0)
    setPartnerDisconnected(false)
    setMessages([])
    messageIdsRef.current.clear()
    clientRef.current?.next()
  }

  const handleGoHome = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = undefined
    }
    setChatDuration(0)
    setMessages([])
    messageIdsRef.current.clear()
    setUnreadCount(0)
    setIsAtBottom(true)
    setPartnerDisconnected(false)

    clientRef.current?.disconnect()
    setChatState("disconnected")
    setUserConnectionQuality("disconnected")
    setIsPartnerTyping(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    setUnreadCount(0)
  }

  const remainingChars = MAX_MESSAGE_LENGTH - inputValue.length

  return (
    <div className="flex h-full relative">
      <div className="flex flex-col flex-1 relative" style={{ fontSize: `${settings.fontSize}px` }}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card/95 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground/80">{onlineCount}명 접속중</span>
            <div className="flex items-center gap-1.5">
              {userConnectionQuality === "good" && <Wifi className="w-3.5 h-3.5 text-green-500" />}
              {userConnectionQuality === "poor" && <Wifi className="w-3.5 h-3.5 text-yellow-500" />}
              {userConnectionQuality === "disconnected" && <WifiOff className="w-3.5 h-3.5 text-red-500" />}
              <span className="text-xs text-foreground/60">
                {userConnectionQuality === "good" && "연결됨"}
                {userConnectionQuality === "poor" && "불안정"}
                {userConnectionQuality === "disconnected" && "연결 끊김"}
              </span>
            </div>
            {chatState === "chatting" && !partnerDisconnected && (
              <div className="text-sm font-medium text-foreground/80">{formatTime(chatDuration)}</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(chatState === "chatting" || partnerDisconnected) && (
              <>
                <Button onClick={handleGoHome} variant="ghost" size="sm" className="gap-1.5 h-8 px-3">
                  <Home className="w-3.5 h-3.5" />
                  <span className="text-sm">홈</span>
                </Button>
                <Button onClick={handleNext} variant="ghost" size="sm" className="gap-1.5 h-8 px-3">
                  <SkipForward className="w-3.5 h-3.5" />
                  <span className="text-sm">다음</span>
                </Button>
              </>
            )}
            <SettingsDialog />
            <ThemeToggle />
            {chatState === "chatting" && !partnerDisconnected && <ReportDialog />}
          </div>
        </div>

        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-3">
          {chatState === "disconnected" && !partnerDisconnected && (
            <div className="flex flex-col items-center justify-center h-full gap-8 px-4">
              <div className="text-center space-y-3 max-w-md">
                <h1 className="text-4xl font-bold tracking-tight">랜덤 채팅</h1>
                <p className="text-lg text-muted-foreground">익명으로 새로운 사람과 대화를 시작하세요</p>
              </div>
              <Button
                onClick={handleStartChat}
                size="lg"
                className="gap-2 px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                채팅 시작하기
              </Button>
            </div>
          )}

          {chatState === "waiting" && (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-muted/30"></div>
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
              </div>
              <p className="text-base font-medium text-muted-foreground">상대를 찾고 있습니다...</p>
              <Button
                onClick={() => clientRef.current?.cancelSearch()}
                variant="outline"
                size="sm"
                className="gap-2 mt-2"
              >
                <X className="w-4 h-4" />
                취소
              </Button>
            </div>
          )}

          {(chatState === "chatting" || partnerDisconnected) &&
            messages.map((message) => (
              <div key={message.id}>
                <div
                  className={cn(
                    "flex",
                    message.sender === "user" && "justify-end",
                    message.sender === "partner" && "justify-start",
                    message.sender === "system" && "justify-center",
                  )}
                >
                  {message.sender === "system" ? (
                    <div className="text-xs text-foreground/60 text-center px-3 py-1.5 bg-muted/50 rounded-full">
                      {message.content}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2 break-words w-fit",
                          message.sender === "user" && "bg-primary text-primary-foreground shadow-sm",
                          message.sender === "partner" && "bg-muted text-foreground shadow-sm",
                          settings.bubbleStyle === "square" && "rounded-lg",
                        )}
                      >
                        {message.content}
                      </div>
                      <div className={cn("flex items-center gap-1 px-1", message.sender === "user" && "justify-end")}>
                        <span className="text-xs text-foreground/60">{formatMessageTime(message.timestamp)}</span>
                        {message.sender === "user" && message.status === "sending" && (
                          <Loader2 className="w-3 h-3 animate-spin text-foreground/60" />
                        )}
                        {message.sender === "user" && message.status === "sent" && (
                          <CheckCheck className="w-3 h-3 text-foreground/60" />
                        )}
                        {message.sender === "user" && message.status === "failed" && (
                          <AlertCircle className="w-3 h-3 text-destructive" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

          {isPartnerTyping && chatState === "chatting" && !partnerDisconnected && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2.5 shadow-sm">
                <div className="flex gap-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: "0ms", animationDuration: "1s" }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: "150ms", animationDuration: "1s" }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: "300ms", animationDuration: "1s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-card/95 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground/60">
              {remainingChars < 50 && !partnerDisconnected && (
                <span className={cn(remainingChars < 0 && "text-destructive font-medium")}>
                  {remainingChars}자 남음
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={partnerDisconnected ? "상대가 나갔습니다" : "메시지를 입력하세요..."}
              className="flex-1 h-10 bg-background"
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={partnerDisconnected}
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              disabled={!inputValue.trim() || partnerDisconnected}
              className="h-10 w-10 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
