// In-memory storage for chat sessions
type ChatSession = {
  userId: string
  partnerId: string | null
  messages: Array<{ content: string; sender: "user" | "partner"; timestamp: string }>
  isTyping: boolean
  lastActivity: number
  connectedAt: number
}

type QueueEntry = {
  userId: string
  timestamp: number
}

class ChatStore {
  private sessions = new Map<string, ChatSession>()
  private queue: QueueEntry[] = []
  private queueSet = new Set<string>()
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000 // 5 minutes
  private readonly CLEANUP_INTERVAL = 60 * 1000 // 1 minute
  private matchingLock = new Set<string>()

  constructor() {
    // Cleanup inactive sessions periodically
    if (typeof window === "undefined") {
      setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL)
    }
  }

  createSession(userId: string): ChatSession {
    const existingSession = this.sessions.get(userId)
    if (existingSession) {
      console.log("[v0] Reusing existing session for userId:", userId)
      existingSession.lastActivity = Date.now()
      return existingSession
    }

    const session: ChatSession = {
      userId,
      partnerId: null,
      messages: [],
      isTyping: false,
      lastActivity: Date.now(),
      connectedAt: Date.now(),
    }
    this.sessions.set(userId, session)
    console.log("[v0] Created new session for userId:", userId, "Total sessions:", this.sessions.size)
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
    this.matchingLock.delete(userId)
    console.log("[v0] Session deleted for userId:", userId, "Total sessions:", this.sessions.size)
  }

  addToQueue(userId: string) {
    if (!this.queueSet.has(userId)) {
      this.queue.push({ userId, timestamp: Date.now() })
      this.queueSet.add(userId)
    }
  }

  removeFromQueue(userId: string) {
    this.queue = this.queue.filter((entry) => entry.userId !== userId)
    this.queueSet.delete(userId)
  }

  findMatch(userId: string): string | null {
    if (this.matchingLock.has(userId)) {
      return null
    }

    this.matchingLock.add(userId)

    // Remove current user from queue if present
    this.removeFromQueue(userId)

    // Find first available user in queue
    for (let i = 0; i < this.queue.length; i++) {
      const entry = this.queue[i]

      if (this.matchingLock.has(entry.userId)) {
        continue
      }

      const partnerSession = this.sessions.get(entry.userId)

      if (partnerSession && !partnerSession.partnerId && entry.userId !== userId) {
        // Match found!
        this.queue.splice(i, 1)
        this.queueSet.delete(entry.userId)
        this.matchingLock.add(entry.userId)
        return entry.userId
      }
    }

    // No match found, add to queue
    this.addToQueue(userId)
    this.matchingLock.delete(userId)
    return null
  }

  connectPartners(userId: string, partnerId: string) {
    const userSession = this.sessions.get(userId)
    const partnerSession = this.sessions.get(partnerId)

    if (userSession && partnerSession) {
      userSession.partnerId = partnerId
      userSession.messages = []
      userSession.isTyping = false
      partnerSession.partnerId = userId
      partnerSession.messages = []
      partnerSession.isTyping = false

      this.matchingLock.delete(userId)
      this.matchingLock.delete(partnerId)
    }
  }

  disconnectPartner(userId: string) {
    const session = this.sessions.get(userId)
    if (!session || !session.partnerId) return

    const partnerSession = this.sessions.get(session.partnerId)
    if (partnerSession) {
      partnerSession.partnerId = null
      partnerSession.isTyping = false
    }

    session.partnerId = null
    session.isTyping = false
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

      if (session.messages.length > 1000) {
        session.messages = session.messages.slice(-1000)
      }
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

    const validQueue: QueueEntry[] = []
    const validQueueSet = new Set<string>()

    this.queue.forEach((entry) => {
      if (now - entry.timestamp < this.SESSION_TIMEOUT && this.sessions.has(entry.userId)) {
        validQueue.push(entry)
        validQueueSet.add(entry.userId)
      }
    })

    this.queue = validQueue
    this.queueSet = validQueueSet

    this.matchingLock.forEach((userId) => {
      if (!this.sessions.has(userId)) {
        this.matchingLock.delete(userId)
      }
    })
  }
}

const globalForChatStore = globalThis as unknown as {
  chatStore: ChatStore | undefined
}

export const chatStore = globalForChatStore.chatStore ?? new ChatStore()

if (process.env.NODE_ENV !== "production") {
  globalForChatStore.chatStore = chatStore
}
