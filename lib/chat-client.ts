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

  constructor(
    private onStatusChange: (status: ChatStatus) => void,
    private onMessages: (messages: MessageType[]) => void,
    private onTyping: (isTyping: boolean) => void,
    private onOnlineCount: (count: number) => void,
    private onPartnerDisconnected: () => void,
  ) {}

  async connect() {
    try {
      const response = await fetch("/api/chat/connect", { method: "POST" })
      const data = await response.json()

      this.userId = data.userId
      this.onOnlineCount(data.onlineCount)
      this.startPolling()
    } catch (error) {
      console.error("Failed to connect:", error)
    }
  }

  private startPolling() {
    if (this.pollInterval) return

    this.pollInterval = setInterval(async () => {
      if (!this.userId) return

      try {
        const response = await fetch("/api/chat/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: this.userId,
            lastMessageCount: this.messageCount,
          }),
        })

        const data = await response.json()

        if (data.messages && data.messages.length > 0) {
          this.messageCount += data.messages.length
          this.onMessages(data.messages)
        }

        this.onTyping(data.isPartnerTyping)
        this.onOnlineCount(data.onlineCount)

        if (data.partnerDisconnected && this.status === "chatting") {
          this.status = "disconnected"
          this.messageCount = 0
          this.onStatusChange("disconnected")
          this.onPartnerDisconnected()
        }

        // Update status based on partner presence
        if (data.hasPartner && this.status !== "chatting") {
          this.status = "chatting"
          this.messageCount = 0
          this.onStatusChange("chatting")
        }
      } catch (error) {
        console.error("Polling error:", error)
      }
    }, 500) // Poll every 500ms
  }

  async findPartner() {
    if (!this.userId) return

    this.status = "waiting"
    this.messageCount = 0
    this.onStatusChange("waiting")

    try {
      const response = await fetch("/api/chat/find-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      })

      const data = await response.json()

      if (data.status === "matched") {
        this.status = "chatting"
        this.onStatusChange("chatting")
      }
    } catch (error) {
      console.error("Failed to find partner:", error)
    }
  }

  async sendMessage(content: string) {
    if (!this.userId) return

    try {
      await fetch("/api/chat/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, content }),
      })
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  async sendTyping(isTyping: boolean) {
    if (!this.userId) return

    try {
      await fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, isTyping }),
      })
    } catch (error) {
      console.error("Failed to send typing status:", error)
    }
  }

  async next() {
    await this.findPartner()
  }

  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    if (this.userId) {
      fetch("/api/chat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId }),
      }).catch(console.error)
    }

    this.userId = null
    this.status = "disconnected"
  }
}
