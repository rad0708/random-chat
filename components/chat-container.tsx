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
import { Send, SkipForward, Loader2, CheckCheck, AlertCircle, X, ArrowDown } from "lucide-react"
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
const TEST_MODE_RESPONSES = [
  "안녕하세요! 테스트 모드입니다.",
  "좋은 하루 보내세요!",
  "재미있는 이야기네요.",
  "그렇군요, 이해했습니다.",
  "저도 그렇게 생각해요.",
  "흥미로운 주제네요!",
  "더 자세히 말씀해주시겠어요?",
  "정말요? 신기하네요!",
]

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
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor">("good")
  const [isMounted, setIsMounted] = useState(false)
  const [isTestMode, setIsTestMode] = useState(false)

  const clientRef = useRef<ChatClient | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const chatStartTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<NodeJS.Timeout>()
  const soundManagerRef = useRef<SoundManager>(new SoundManager())
  const messageIdsRef = useRef<Set<string>>(new Set())

  const { toast } = useToast()
  const settings = useSettings()

  useEffect(() => {
    soundManagerRef.current.setEnabled(settings.soundEnabled)
  }, [settings.soundEnabled])

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
    const checkConnectionQuality = () => {
      if (chatState === "disconnected") {
        setConnectionQuality("poor")
      } else if (chatState === "waiting") {
        setConnectionQuality("fair")
      } else if (chatState === "chatting") {
        setConnectionQuality("good")
      }
    }

    checkConnectionQuality()
  }, [chatState])

  useEffect(() => {
    setIsMounted(true)

    const client = new ChatClient(
      (status) => {
        setChatState(status)
        if (status === "chatting") {
          setMessages([])
          messageIdsRef.current.clear()
          setChatDuration(0)
          chatStartTimeRef.current = Date.now()

          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = setInterval(() => {
            setChatDuration(Math.floor((Date.now() - chatStartTimeRef.current) / 1000))
          }, 1000)

          addSystemMessage("상대와 연결되었습니다!")
          soundManagerRef.current.playConnectSound()
        }
      },
      (newMessages) => {
        newMessages.forEach((msg) => {
          const messageId = `${msg.sender}-${msg.timestamp}-${msg.content.substring(0, 20)}`

          if (!messageIdsRef.current.has(messageId)) {
            messageIdsRef.current.add(messageId)
            addMessage(msg.content, msg.sender, msg.timestamp, "sent")

            if (msg.sender === "partner") {
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
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
        addSystemMessage("상대가 대화를 종료했습니다.")
        soundManagerRef.current.playDisconnectSound()
        setChatDuration(0)
      },
      (error) => {
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
    window.addEventListener("beforeunload", handleBeforeUnload)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - could pause some operations
      } else {
        // Tab is visible again
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      client.disconnect()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
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

  const simulatePartnerResponse = useCallback(() => {
    if (!isTestMode || chatState !== "chatting") return

    setIsPartnerTyping(true)

    setTimeout(
      () => {
        setIsPartnerTyping(false)

        const randomResponse = TEST_MODE_RESPONSES[Math.floor(Math.random() * TEST_MODE_RESPONSES.length)]
        addMessage(randomResponse, "partner", undefined, "sent")
        soundManagerRef.current.playMessageSound()

        if (!isAtBottom) {
          setUnreadCount((prev) => prev + 1)
        }
      },
      1000 + Math.random() * 2000,
    )
  }, [isTestMode, chatState, isAtBottom])

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || chatState !== "chatting") return

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
    setInputValue("")
    setLastMessageTime(now)

    addMessage(messageContent, "user", undefined, "sending")

    if (isTestMode) {
      setTimeout(() => {
        setMessages((prev) => prev.map((msg) => (msg.status === "sending" ? { ...msg, status: "sent" as const } : msg)))
        simulatePartnerResponse()
      }, 500)
    } else {
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
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (settings.showTypingIndicator && !isTestMode) {
      clientRef.current?.sendTyping(false)
    }
  }, [inputValue, chatState, lastMessageTime, settings.showTypingIndicator, toast, isTestMode, simulatePartnerResponse])

  const handleInputChange = (value: string) => {
    setInputValue(value)

    if (chatState === "chatting" && settings.showTypingIndicator && !isTestMode) {
      clientRef.current?.sendTyping(true)

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        clientRef.current?.sendTyping(false)
      }, 1000)
    }
  }

  const handleStartTestMode = () => {
    setIsTestMode(true)
    setChatState("chatting")
    setMessages([])
    messageIdsRef.current.clear()
    setChatDuration(0)
    chatStartTimeRef.current = Date.now()

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    timerIntervalRef.current = setInterval(() => {
      setChatDuration(Math.floor((Date.now() - chatStartTimeRef.current) / 1000))
    }, 1000)

    addSystemMessage("테스트 모드로 연결되었습니다!")
    soundManagerRef.current.playConnectSound()

    setTimeout(() => {
      addMessage("안녕하세요! 테스트 봇입니다. 메시지를 보내보세요!", "partner", undefined, "sent")
    }, 1000)
  }

  const handleStartChat = () => {
    if (chatState !== "disconnected") return
    setIsTestMode(false)
    clientRef.current?.findPartner()
  }

  const handleNext = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setChatDuration(0)

    if (isTestMode) {
      setMessages([])
      messageIdsRef.current.clear()
      chatStartTimeRef.current = Date.now()
      addSystemMessage("새로운 테스트 세션이 시작되었습니다!")
      setTimeout(() => {
        addMessage("안녕하세요! 새로운 테스트 봇입니다.", "partner", undefined, "sent")
      }, 1000)
    } else {
      clientRef.current?.next()
    }
  }

  const handleCancelSearch = () => {
    if (chatState === "waiting") {
      clientRef.current?.cancelSearch()
      setChatState("disconnected")
      setMessages([])
      messageIdsRef.current.clear()
      setChatDuration(0)
      setOnlineCount(0)
      setUnreadCount(0)
      setIsAtBottom(true)
      setConnectionQuality("good")
      setIsMounted(false)
      setIsTestMode(false)
      soundManagerRef.current.playDisconnectSound()
    }
  }

  const handleGoHome = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setChatDuration(0)
    setMessages([])
    messageIdsRef.current.clear()
    setChatState("disconnected")
    setOnlineCount(0)
    setUnreadCount(0)
    setIsAtBottom(true)
    setConnectionQuality("good")
    setIsTestMode(false)

    if (!isTestMode) {
      clientRef.current?.disconnect()
    }
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
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card/95 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300",
                  connectionQuality === "good" && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                  connectionQuality === "fair" && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
                  connectionQuality === "poor" && "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
                )}
                title={
                  connectionQuality === "good"
                    ? "연결 상태 양호"
                    : connectionQuality === "fair"
                      ? "연결 대기중"
                      : "연결 끊김"
                }
              />
              <span className="text-sm font-medium text-foreground/80 whitespace-nowrap">
                {isTestMode ? "테스트 모드" : `${onlineCount}명 접속중`}
              </span>
            </div>
            {chatState === "chatting" && (
              <div className="text-sm font-medium text-foreground/80 whitespace-nowrap">{formatTime(chatDuration)}</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {chatState === "chatting" && (
              <Button
                onClick={handleGoHome}
                variant="outline"
                size="sm"
                className="gap-2 border-border/50 hover:border-border bg-transparent hover:bg-accent"
              >
                홈
              </Button>
            )}
            <SettingsDialog />
            <ThemeToggle />
            {chatState === "chatting" && !isTestMode && <ReportDialog />}
            {chatState === "chatting" && (
              <Button
                onClick={handleNext}
                variant="outline"
                size="sm"
                className="gap-2 border-border/50 hover:border-border bg-transparent hover:bg-accent"
              >
                <SkipForward className="w-4 h-4" />
                다음
              </Button>
            )}
          </div>
        </div>

        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatState === "disconnected" && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-10 px-4">
              <div className="text-center space-y-4 max-w-lg">
                <h1 className="text-5xl font-bold tracking-tight">랜덤 채팅</h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  익명으로 새로운 사람과 대화를 시작하세요
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleStartChat}
                  size="lg"
                  className="gap-2 px-10 py-7 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  채팅 시작하기
                </Button>
                <Button
                  onClick={handleStartTestMode}
                  size="lg"
                  variant="outline"
                  className="gap-2 px-10 py-7 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-transparent"
                >
                  테스트 모드
                </Button>
              </div>
            </div>
          )}

          {chatState === "waiting" && (
            <div className="flex flex-col items-center justify-center h-full gap-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-muted/30"></div>
                <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
              </div>
              <p className="text-lg font-medium text-muted-foreground">상대를 찾고 있습니다...</p>
              <Button onClick={handleCancelSearch} variant="outline" size="sm" className="gap-2 mt-2 bg-transparent">
                <X className="w-4 h-4" />
                취소
              </Button>
            </div>
          )}

          {messages.map((message) => (
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
                  <div className="text-xs text-foreground/60 text-center px-4 py-2 bg-muted/60 rounded-full backdrop-blur-sm">
                    {message.content}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-w-[75%]">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 break-words transition-all duration-200 w-fit",
                        message.sender === "user" && "bg-primary text-primary-foreground shadow-md hover:shadow-lg",
                        message.sender === "partner" && "bg-muted text-foreground shadow-sm hover:shadow-md",
                        settings.bubbleStyle === "square" && "rounded-lg",
                      )}
                    >
                      {message.content}
                    </div>
                    <div className={cn("flex items-center gap-1.5 px-1", message.sender === "user" && "justify-end")}>
                      <span className="text-xs text-foreground/70 font-medium">
                        {formatMessageTime(message.timestamp)}
                      </span>
                      {message.sender === "user" && message.status === "sending" && (
                        <Loader2 className="w-3 h-3 animate-spin text-foreground/70" />
                      )}
                      {message.sender === "user" && message.status === "sent" && (
                        <CheckCheck className="w-3.5 h-3.5 text-foreground/70" />
                      )}
                      {message.sender === "user" && message.status === "failed" && (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isPartnerTyping && chatState === "chatting" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-5 py-3.5 shadow-sm">
                <div className="flex gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: "0ms", animationDuration: "1s" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: "150ms", animationDuration: "1s" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: "300ms", animationDuration: "1s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {!isAtBottom && chatState === "chatting" && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10">
            <Button
              onClick={scrollToBottom}
              variant="secondary"
              size="sm"
              className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 border border-border/50"
            >
              <ArrowDown className="w-4 h-4" />
              {unreadCount > 0 ? `${unreadCount}개의 새 메시지` : "최신 메시지 보기"}
            </Button>
          </div>
        )}

        {chatState === "chatting" && (
          <div className="p-5 border-t bg-card/95 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-foreground/60">
                {remainingChars < 50 && (
                  <span className={cn(remainingChars < 0 && "text-destructive font-medium")}>
                    {remainingChars}자 남음
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-3">
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="메시지를 입력하세요..."
                className="flex-1 h-11 bg-background border-border/50 focus:border-primary/50 transition-colors"
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <Button
                onClick={handleSendMessage}
                size="icon"
                disabled={!inputValue.trim()}
                className="h-11 w-11 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
