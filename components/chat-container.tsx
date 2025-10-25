"use client"

import { useEffect, useRef, useState } from "react"
import { ChatClient, type ChatStatus } from "@/lib/chat-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { ReportDialog } from "@/components/report-dialog"
import { SettingsDialog, useSettings } from "@/components/settings-dialog"
import { ChatHistoryDialog, saveChatSession } from "@/components/chat-history-dialog"
import { containsProfanity, isSpam } from "@/lib/profanity-filter"
import { SoundManager } from "@/lib/sound-manager"
import { verifyCaptcha } from "@/app/actions/verify-captcha"
import { Send, SkipForward, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import HCaptcha from "@hcaptcha/react-hcaptcha"

type ChatMessage = {
  id: string
  content: string
  sender: "user" | "partner" | "system"
  timestamp: string
}

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [chatState, setChatState] = useState<ChatStatus>("disconnected")
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatDuration, setChatDuration] = useState(0)
  const [isVerified, setIsVerified] = useState(false)
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const clientRef = useRef<ChatClient | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const chatStartTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<NodeJS.Timeout>()
  const soundManagerRef = useRef<SoundManager>(new SoundManager())
  const captchaRef = useRef<HCaptcha>(null)

  const { toast } = useToast()
  const settings = useSettings()

  useEffect(() => {
    soundManagerRef.current.setEnabled(settings.soundEnabled)
  }, [settings.soundEnabled])

  useEffect(() => {
    const client = new ChatClient(
      (status) => {
        setChatState(status)
        if (status === "chatting") {
          setMessages([])
          setChatDuration(0)
          chatStartTimeRef.current = Date.now()

          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = setInterval(() => {
            setChatDuration(Math.floor((Date.now() - chatStartTimeRef.current) / 1000))
          }, 1000)

          addSystemMessage("상대와 연결되었습니다!")
          soundManagerRef.current.playConnectSound()
          showNotification("새로운 채팅", "상대와 연결되었습니다!")
        } else if (status === "waiting") {
          addSystemMessage("상대를 찾고 있습니다...")
        }
      },
      (newMessages) => {
        newMessages.forEach((msg) => {
          addMessage(msg.content, msg.sender, msg.timestamp)
          if (msg.sender === "partner") {
            soundManagerRef.current.playMessageSound()
            showNotification("새 메시지", msg.content)
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
        const userMessages = messages.filter((m) => m.sender === "user" || m.sender === "partner").length
        if (userMessages > 0) {
          saveChatSession(userMessages, chatDuration)
        }

        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
        addSystemMessage("상대가 대화를 종료했습니다.")
        soundManagerRef.current.playDisconnectSound()
      },
    )

    clientRef.current = client
    client.connect()

    if (settings.notificationsEnabled && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    return () => {
      client.disconnect()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }

    const timer = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(timer)
  }, [messages, isPartnerTyping])

  const addMessage = (content: string, sender: "user" | "partner" | "system", timestamp?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        content,
        sender,
        timestamp: timestamp || new Date().toISOString(),
      },
    ])
  }

  const addSystemMessage = (content: string) => {
    addMessage(content, "system")
  }

  const handleSendMessage = () => {
    if (!inputValue.trim() || chatState !== "chatting") return

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

    clientRef.current?.sendMessage(inputValue)
    addMessage(inputValue, "user")
    setInputValue("")

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (settings.showTypingIndicator) {
      clientRef.current?.sendTyping(false)
    }
  }

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
    if (!isVerified) {
      setShowCaptcha(true)
      return
    }
    clientRef.current?.findPartner()
  }

  const handleCaptchaVerify = async (token: string) => {
    setIsVerifying(true)
    try {
      const result = await verifyCaptcha(token)

      if (result.success) {
        setIsVerified(true)
        setShowCaptcha(false)
        clientRef.current?.findPartner()
      } else {
        toast({
          title: "인증 실패",
          description: result.error || "다시 시도해주세요.",
          variant: "destructive",
        })
        captchaRef.current?.resetCaptcha()
      }
    } catch (error) {
      toast({
        title: "인증 오류",
        description: "다시 시도해주세요.",
        variant: "destructive",
      })
      captchaRef.current?.resetCaptcha()
    } finally {
      setIsVerifying(false)
    }
  }

  const handleNext = () => {
    const userMessages = messages.filter((m) => m.sender === "user" || m.sender === "partner").length
    if (userMessages > 0) {
      saveChatSession(userMessages, chatDuration)
    }

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setChatDuration(0)

    clientRef.current?.next()
  }

  const showNotification = (title: string, body: string) => {
    if (!settings.notificationsEnabled || !("Notification" in window)) return
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" })
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

  return (
    <div className="flex flex-col h-full" style={{ fontSize: `${settings.fontSize}px` }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">{onlineCount}명 접속중</span>
          </div>
          {chatState === "chatting" && <div className="text-sm text-muted-foreground">{formatTime(chatDuration)}</div>}
        </div>

        <div className="flex items-center gap-2">
          <ChatHistoryDialog />
          <SettingsDialog />
          <ThemeToggle />
          {chatState === "chatting" && <ReportDialog />}
          {chatState === "chatting" && (
            <Button onClick={handleNext} variant="outline" size="sm" className="gap-2 bg-transparent">
              <SkipForward className="w-4 h-4" />
              다음
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatState === "disconnected" && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            {!showCaptcha ? (
              <>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold">랜덤 채팅</h2>
                  <p className="text-muted-foreground">익명으로 새로운 사람과 대화를 시작하세요</p>
                </div>
                <Button onClick={handleStartChat} size="lg" className="gap-2">
                  채팅 시작하기
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">본인 확인</h3>
                  <p className="text-sm text-muted-foreground">로봇이 아님을 확인해주세요</p>
                </div>
                <HCaptcha
                  ref={captchaRef}
                  sitekey="10000000-ffff-ffff-ffff-000000000001"
                  onVerify={handleCaptchaVerify}
                  onError={() => {
                    toast({
                      title: "인증 실패",
                      description: "다시 시도해주세요.",
                      variant: "destructive",
                    })
                  }}
                />
                {isVerifying && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>인증 중...</span>
                  </div>
                )}
                <Button variant="ghost" onClick={() => setShowCaptcha(false)} disabled={isVerifying}>
                  취소
                </Button>
              </div>
            )}
          </div>
        )}

        {chatState === "waiting" && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">상대를 찾고 있습니다...</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.sender === "user" && "justify-end",
              message.sender === "partner" && "justify-start",
              message.sender === "system" && "justify-center",
            )}
          >
            {message.sender === "system" ? (
              <div className="text-xs text-muted-foreground text-center px-4 py-2">{message.content}</div>
            ) : (
              <div className="flex flex-col gap-1 max-w-[70%]">
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2 break-words",
                    message.sender === "user" && "bg-blue-500 text-white",
                    message.sender === "partner" && "bg-muted text-foreground",
                  )}
                >
                  {message.content}
                </div>
                <span className={cn("text-xs text-muted-foreground", message.sender === "user" && "text-right")}>
                  {formatMessageTime(message.timestamp)}
                </span>
              </div>
            )}
          </div>
        ))}

        {isPartnerTyping && chatState === "chatting" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-2">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {chatState === "chatting" && (
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="메시지를 입력하세요..."
              className="flex-1"
            />
            <Button onClick={handleSendMessage} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
