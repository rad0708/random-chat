export type MessageType = {
  content: string
  sender: "user" | "partner"
  timestamp: string
}

export type ChatStatus = "disconnected" | "waiting" | "chatting"

export class ChatClient {
  private userId: string | null = null
  private pollInterval: NodeJS.Timeout | null = null
  private messageCount = 0
  private status: ChatStatus = "disconnected"
  private isIntentionalDisconnect = false
  private isConnecting = false
  private isFindingPartner = false
  private isCanceling = false
  private lastPollTime = 0
  private consecutiveErrors = 0
  private readonly MAX_RETRIES = 3
  private readonly POLL_INTERVAL = 1000

  constructor(
    private onStatusChange: (status: ChatStatus) => void,
    private onMessages: (messages: MessageType[]) => void,
    private onTyping: (isTyping: boolean) => void,
    private onOnlineCount: (count: number) => void,
    private onPartnerDisconnected: () => void,
    private onError?: (error: string) => void,
  ) {}

  isReady(): boolean {
    return this.userId !== null && !this.isIntentionalDisconnect
  }

  getUserId(): string | null {
    return this.userId
  }

  async connect() {
    if (this.isConnecting || this.userId) return

    this.isIntentionalDisconnect = false
    this.isConnecting = true
    try {
      const response = await fetch("/api/chat/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to connect to server")
      }

      const data = await response.json()

      this.userId = data.userId
      this.onOnlineCount(data.onlineCount)
      this.consecutiveErrors = 0
      this.startPolling()
    } catch (error) {
      console.error("[v0] Failed to connect:", error)
      this.onError?.("연결에 실패했습니다. 다시 시도해주세요.")
      this.consecutiveErrors++

      if (this.consecutiveErrors < this.MAX_RETRIES) {
        setTimeout(
          () => {
            this.isConnecting = false
            this.connect()
          },
          Math.min(1000 * Math.pow(2, this.consecutiveErrors), 10000),
        )
      }
    } finally {
      this.isConnecting = false
    }
  }

  private startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    this.pollInterval = setInterval(async () => {
      if (!this.userId || this.isIntentionalDisconnect) return

      const now = Date.now()
      if (now - this.lastPollTime < this.POLL_INTERVAL - 100) return
      this.lastPollTime = now

      try {
        const response = await fetch("/api/chat/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: this.userId,
            lastMessageCount: this.messageCount,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || "Poll request failed")
        }

        const data = await response.json()

        this.consecutiveErrors = 0

        if (data.messages && data.messages.length > 0) {
          this.messageCount += data.messages.length
          this.onMessages(data.messages)
        }

        this.onTyping(data.isPartnerTyping || false)

        if (data.onlineCount !== undefined) {
          this.onOnlineCount(data.onlineCount)
        }

        if (data.partnerDisconnected && this.status === "chatting") {
          this.status = "disconnected"
          this.messageCount = 0
          this.onStatusChange("disconnected")
          this.onPartnerDisconnected()
        }

        if (data.hasPartner && this.status !== "chatting") {
          this.status = "chatting"
          this.messageCount = 0
          this.onStatusChange("chatting")
        } else if (!data.hasPartner && this.status === "chatting" && !data.partnerDisconnected) {
          this.status = "disconnected"
          this.messageCount = 0
          this.onStatusChange("disconnected")
          this.onPartnerDisconnected()
        }
      } catch (error) {
        console.error("[v0] Polling error:", error)
        this.consecutiveErrors++

        if (this.consecutiveErrors >= this.MAX_RETRIES) {
          this.stopPolling()
          this.onError?.("연결이 불안정합니다. 재연결을 시도합니다.")

          setTimeout(() => {
            if (!this.isIntentionalDisconnect) {
              this.reconnect()
            }
          }, 2000)
        }
      }
    }, this.POLL_INTERVAL)
  }

  private async reconnect() {
    this.stopPolling()
    const oldUserId = this.userId
    this.userId = null
    this.consecutiveErrors = 0

    if (oldUserId) {
      try {
        await fetch("/api/chat/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: oldUserId }),
        })
      } catch (error) {
        console.error("[v0] Failed to disconnect old session:", error)
      }
    }

    await this.connect()
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  async findPartner() {
    if (!this.userId) {
      await this.connect()
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (!this.userId || this.isFindingPartner) {
      return
    }

    this.isFindingPartner = true
    this.status = "waiting"
    this.messageCount = 0
    this.isIntentionalDisconnect = false
    this.onStatusChange("waiting")

    try {
      const response = await fetch("/api/chat/find-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to find partner")
      }

      const data = await response.json()

      if (data.onlineCount !== undefined) {
        this.onOnlineCount(data.onlineCount)
      }

      if (data.status === "matched") {
        if (data.partnerId === this.userId) {
          console.error("[v0] Self-connection detected, retrying...")
          this.status = "waiting"
          this.onStatusChange("waiting")
          setTimeout(() => {
            if (this.status === "waiting") {
              this.isFindingPartner = false
              this.findPartner()
            }
          }, 1000)
        } else {
          this.status = "chatting"
          this.onStatusChange("chatting")
        }
      }
    } catch (error) {
      console.error("[v0] Failed to find partner:", error)
      this.onError?.("상대 찾기에 실패했습니다.")
      this.status = "disconnected"
      this.onStatusChange("disconnected")
    } finally {
      this.isFindingPartner = false
    }
  }

  async sendMessage(content: string) {
    if (!this.userId) {
      this.onError?.("연결이 끊어졌습니다. 다시 연결해주세요.")
      return false
    }

    if (this.status !== "chatting") {
      this.onError?.("채팅 상대가 없습니다.")
      return false
    }

    try {
      const response = await fetch("/api/chat/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, content }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))

        if (errorData.error === "No active chat") {
          this.status = "disconnected"
          this.onStatusChange("disconnected")
        }
        this.onError?.(errorData.error || "Unknown error")
        return false
      }
    } catch (error) {
      console.error("[v0] Failed to send message:", error)
      this.onError?.("메시지를 보내는 데 실패했습니다.")
      return false
    }

    return true
  }

  async sendTyping(isTyping: boolean) {
    if (!this.userId || this.status !== "chatting") return

    try {
      await fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, isTyping }),
      })
    } catch (error) {
      console.error("[v0] Failed to send typing status:", error)
    }
  }

  async cancelSearch() {
    if (!this.userId || this.isCanceling) return

    this.isCanceling = true
    this.isIntentionalDisconnect = true

    try {
      await fetch("/api/chat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })

      this.status = "disconnected"
      this.messageCount = 0
      this.onStatusChange("disconnected")
    } catch (error) {
      console.error("[v0] Failed to cancel search:", error)
    } finally {
      this.isCanceling = false
      this.isIntentionalDisconnect = false
    }
  }

  async next() {
    if (!this.userId) return

    this.isIntentionalDisconnect = true
    this.status = "waiting"
    this.messageCount = 0

    try {
      await fetch("/api/chat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })

      this.isIntentionalDisconnect = false
      await this.findPartner()
    } catch (error) {
      console.error("[v0] Failed to find next partner:", error)
      this.onError?.("다음 상대를 찾는 데 실패했습니다.")
      this.isIntentionalDisconnect = false
    }
  }

  async disconnect() {
    if (!this.userId) return

    this.isIntentionalDisconnect = true
    this.stopPolling()

    try {
      await fetch("/api/chat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })
    } catch (error) {
      console.error("[v0] Failed to disconnect:", error)
    } finally {
      this.userId = null
      this.status = "disconnected"
      this.messageCount = 0
    }
  }
}
