// In-memory storage for chat sessions
type ChatSession = {
  userId: string
  partnerId: string | null
  messages: Array<{ content: string; sender: "user" | "partner"; timestamp: string }>
  isTyping: boolean
  lastActivity: number
}

type QueueEntry = {
  userId: string
  timestamp: number
}

class ChatStore {
  private sessions = new Map<string, ChatSession>()
  private queue: QueueEntry[] = []
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000 // 5 minutes
  private readonly CLEANUP_INTERVAL = 60 * 1000 // 1 minute

  constructor() {
    // Cleanup inactive sessions periodically
    if (typeof window === "undefined") {
      setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL)
    }
  }

  createSession(userId: string): ChatSession {
    const session: ChatSession = {
      userId,
      partnerId: null,
      messages: [],
      isTyping: false,
      lastActivity: Date.now(),
    }
    this.sessions.set(userId, session)
    return session
  }

  getSession(userId: string): ChatSession | undefined {
    const session = this.sessions.get(userId)
    if (session) {
      session.lastActivity = Date.now()
    }
    return session
  }

  deleteSession(userId: string) {
    const session = this.sessions.get(userId)
    if (session?.partnerId) {
      this.disconnectPartner(userId)
    }
    this.sessions.delete(userId)
    this.removeFromQueue(userId)
  }

  addToQueue(userId: string) {
    if (!this.queue.find((entry) => entry.userId === userId)) {
      this.queue.push({ userId, timestamp: Date.now() })
    }
  }

  removeFromQueue(userId: string) {
    this.queue = this.queue.filter((entry) => entry.userId !== userId)
  }

  findMatch(userId: string): string | null {
    // Remove current user from queue if present
    this.removeFromQueue(userId)

    // Find first available user in queue
    for (let i = 0; i < this.queue.length; i++) {
      const entry = this.queue[i]
      const partnerSession = this.sessions.get(entry.userId)

      if (partnerSession && !partnerSession.partnerId && entry.userId !== userId) {
        // Match found!
        this.queue.splice(i, 1)
        return entry.userId
      }
    }

    // No match found, add to queue
    this.addToQueue(userId)
    return null
  }

  connectPartners(userId: string, partnerId: string) {
    const userSession = this.sessions.get(userId)
    const partnerSession = this.sessions.get(partnerId)

    if (userSession && partnerSession) {
      userSession.partnerId = partnerId
      userSession.messages = []
      partnerSession.partnerId = userId
      partnerSession.messages = []
    }
  }

  disconnectPartner(userId: string) {
    const session = this.sessions.get(userId)
    if (!session || !session.partnerId) return

    const partnerSession = this.sessions.get(session.partnerId)
    if (partnerSession) {
      partnerSession.partnerId = null
    }

    session.partnerId = null
    this.removeFromQueue(userId)
  }

  addMessage(userId: string, content: string, sender: "user" | "partner") {
    const session = this.sessions.get(userId)
    if (session) {
      const message = {
        content,
        sender,
        timestamp: new Date().toISOString(),
      }
      session.messages.push(message)
      session.lastActivity = Date.now()
    }
  }

  setTyping(userId: string, isTyping: boolean) {
    const session = this.sessions.get(userId)
    if (session) {
      session.isTyping = isTyping
      session.lastActivity = Date.now()
    }
  }

  getOnlineCount(): number {
    return this.sessions.size
  }

  private cleanup() {
    const now = Date.now()
    const toDelete: string[] = []

    this.sessions.forEach((session, userId) => {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        toDelete.push(userId)
      }
    })

    toDelete.forEach((userId) => this.deleteSession(userId))

    // Clean up old queue entries
    this.queue = this.queue.filter((entry) => now - entry.timestamp < this.SESSION_TIMEOUT)
  }
}

export const chatStore = new ChatStore()
