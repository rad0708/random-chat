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
  private readonly POLL_INTERVAL = 500

  constructor(
    private onStatusChange: (status: ChatStatus) => void,
    private onMessages: (messages: MessageType[]) => void,
    private onTyping: (isTyping: boolean) => void,
    private onOnlineCount: (count: number) => void,
    private onPartnerDisconnected: () => void,
    private onError?: (error: string) => void,
  ) {}

  async connect() {
    if (this.isConnecting || this.userId) return

    this.isConnecting = true
    try {
      const response = await fetch("/api/chat/connect", { method: "POST" })

      if (!response.ok) {
        throw new Error("Failed to connect to server")
      }

      const data = await response.json()

      this.userId = data.userId
      this.onOnlineCount(data.onlineCount)
      this.consecutiveErrors = 0
      this.startPolling()
    } catch (error) {
      console.error("Failed to connect:", error)
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
        console.log("[v0] Polling with userId:", this.userId)

        const response = await fetch("/api/chat/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: this.userId,
            lastMessageCount: this.messageCount,
          }),
        })

        console.log("[v0] Poll response status:", response.status)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          console.log("[v0] Poll error response:", errorData)
          throw new Error(errorData.error || "Poll request failed")
        }

        const data = await response.json()
        console.log("[v0] Poll data received:", data)

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
        }
      } catch (error) {
        console.error("[v0] Polling error:", error)
        this.consecutiveErrors++

        if (this.consecutiveErrors >= this.MAX_RETRIES) {
          this.stopPolling()
          this.onError?.("연결이 불안정합니다. 재연결을 시도합니다.")

          // Attempt to reconnect
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

    if (oldUserId) {
      try {
        await fetch("/api/chat/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: oldUserId }),
        })
      } catch (error) {
        console.error("Failed to disconnect old session:", error)
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
    if (!this.userId || this.isFindingPartner) return

    this.isFindingPartner = true
    this.status = "waiting"
    this.messageCount = 0
    this.onStatusChange("waiting")

    try {
      console.log("[v0] Finding partner with userId:", this.userId)

      const response = await fetch("/api/chat/find-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })

      console.log("[v0] Find partner response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.log("[v0] Find partner error response:", errorData)
        throw new Error(errorData.error || "Failed to find partner")
      }

      const data = await response.json()
      console.log("[v0] Find partner data received:", data)

      if (data.onlineCount !== undefined) {
        this.onOnlineCount(data.onlineCount)
      }

      if (data.status === "matched") {
        this.status = "chatting"
        this.onStatusChange("chatting")
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
    if (!this.userId || this.status !== "chatting") return

    try {
      const response = await fetch("/api/chat/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, content }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      const data = await response.json()
      if (data.onlineCount !== undefined) {
        this.onOnlineCount(data.onlineCount)
      }

      return true
    } catch (error) {
      console.error("Failed to send message:", error)
      this.onError?.("메시지 전송에 실패했습니다.")
      return false
    }
  }

  async sendTyping(isTyping: boolean) {
    if (!this.userId || this.status !== "chatting") return

    try {
      const response = await fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, isTyping }),
      })

      if (!response.ok) {
        throw new Error("Failed to send typing status")
      }

      const data = await response.json()
      if (data.onlineCount !== undefined) {
        this.onOnlineCount(data.onlineCount)
      }
    } catch (error) {
      console.error("Failed to send typing status:", error)
    }
  }

  async next() {
    if (this.status === "chatting") {
      await this.disconnectChat()
    }
    await this.findPartner()
  }

  private async disconnectChat() {
    if (!this.userId) return

    try {
      await fetch("/api/chat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })
    } catch (error) {
      console.error("Failed to disconnect from chat:", error)
    }

    this.status = "disconnected"
    this.messageCount = 0
    this.onStatusChange("disconnected")
  }

  async cancelSearch() {
    if (!this.userId || this.status !== "waiting" || this.isCanceling) return

    this.isCanceling = true

    try {
      const response = await fetch("/api/chat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })

      if (!response.ok) {
        throw new Error("Failed to cancel search")
      }

      const data = await response.json()
      if (data.onlineCount !== undefined) {
        this.onOnlineCount(data.onlineCount)
      }

      this.status = "disconnected"
      this.messageCount = 0
      this.onStatusChange("disconnected")
    } catch (error) {
      console.error("Failed to cancel search:", error)
      this.onError?.("취소에 실패했습니다.")
    } finally {
      this.isCanceling = false
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true

    this.stopPolling()

    if (this.userId) {
      fetch("/api/chat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
        keepalive: true,
      }).catch(console.error)
    }

    this.userId = null
    this.status = "disconnected"
    this.messageCount = 0
    this.consecutiveErrors = 0
    this.onStatusChange("disconnected")
  }

  getStatus(): ChatStatus {
    return this.status
  }

  isReady(): boolean {
    return this.userId !== null && !this.isIntentionalDisconnect
  }
}
