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
  private readonly SESSION_TIMEOUT = 60 * 1000 // 60 seconds
  private readonly CLEANUP_INTERVAL = 15 * 1000 // 15 seconds
  private readonly POLL_TIMEOUT = 15 * 1000 // 15 seconds
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
      const partnerSession = this.sessions.get(session.partnerId)
      if (partnerSession) {
        partnerSession.partnerId = null
        partnerSession.isTyping = false
      }
    }
    this.removeFromQueue(userId)
    this.matchingLock.delete(userId)
    this.sessions.delete(userId)
    console.log("[v0] Session deleted for userId:", userId, "Total sessions:", this.sessions.size)
  }

  addToQueue(userId: string) {
    if (!this.queueSet.has(userId)) {
      this.queue.push({ userId, timestamp: Date.now() })
      this.queueSet.add(userId)
      console.log("[v0] Added to queue userId:", userId, "Queue size:", this.queue.length)
    }
  }

  removeFromQueue(userId: string) {
    const sizeBefore = this.queue.length
    this.queue = this.queue.filter((entry) => entry.userId !== userId)
    this.queueSet.delete(userId)
    if (sizeBefore !== this.queue.length) {
      console.log("[v0] Removed from queue userId:", userId, "Queue size:", this.queue.length)
    }
  }

  findMatch(userId: string): string | null {
    const userSession = this.sessions.get(userId)
    if (userSession?.partnerId) {
      console.log("[v0] User already has a partner, skipping match for userId:", userId)
      return null
    }

    if (this.matchingLock.has(userId)) {
      console.log("[v0] User is already in matching process, skipping for userId:", userId)
      return null
    }

    this.matchingLock.add(userId)
    console.log("[v0] Starting match search for userId:", userId, "Queue size:", this.queue.length)

    this.removeFromQueue(userId)

    for (let i = 0; i < this.queue.length; i++) {
      const entry = this.queue[i]

      if (entry.userId === userId) {
        console.log("[v0] Skipping self-match for userId:", userId)
        continue
      }

      if (this.matchingLock.has(entry.userId)) {
        console.log("[v0] Partner is locked, skipping userId:", entry.userId)
        continue
      }

      const partnerSession = this.sessions.get(entry.userId)

      if (partnerSession && !partnerSession.partnerId && entry.userId !== userId) {
        const timeSinceQueued = Date.now() - entry.timestamp
        if (timeSinceQueued > this.SESSION_TIMEOUT) {
          console.log("[v0] Queue entry expired, removing userId:", entry.userId)
          this.queue.splice(i, 1)
          this.queueSet.delete(entry.userId)
          i--
          continue
        }

        console.log("[v0] Match found! userId:", userId, "partnerId:", entry.userId)
        this.queue.splice(i, 1)
        this.queueSet.delete(entry.userId)
        this.matchingLock.add(entry.userId)
        return entry.userId
      }
    }

    console.log("[v0] No match found, adding to queue userId:", userId)
    this.addToQueue(userId)
    this.matchingLock.delete(userId)
    return null
  }

  connectPartners(userId: string, partnerId: string) {
    if (userId === partnerId) {
      console.error("[v0] ERROR: Attempted to connect user to themselves! userId:", userId)
      this.matchingLock.delete(userId)
      this.matchingLock.delete(partnerId)
      this.removeFromQueue(userId)
      this.removeFromQueue(partnerId)
      return
    }

    const userSession = this.sessions.get(userId)
    const partnerSession = this.sessions.get(partnerId)

    if (!userSession || !partnerSession) {
      console.error("[v0] ERROR: Missing session in connectPartners. userId:", userId, "partnerId:", partnerId)
      this.matchingLock.delete(userId)
      this.matchingLock.delete(partnerId)
      return
    }

    if (userSession.partnerId || partnerSession.partnerId) {
      console.error("[v0] ERROR: One or both users already have partners. userId:", userId, "partnerId:", partnerId)
      this.matchingLock.delete(userId)
      this.matchingLock.delete(partnerId)
      return
    }

    console.log("[v0] Connecting partners - userId:", userId, "partnerId:", partnerId)
    userSession.partnerId = partnerId
    userSession.messages = []
    userSession.isTyping = false
    partnerSession.partnerId = userId
    partnerSession.messages = []
    partnerSession.isTyping = false

    this.matchingLock.delete(userId)
    this.matchingLock.delete(partnerId)
  }

  disconnectPartner(userId: string) {
    const session = this.sessions.get(userId)
    if (!session) return

    this.removeFromQueue(userId)

    if (session.partnerId) {
      const partnerSession = this.sessions.get(session.partnerId)
      if (partnerSession) {
        partnerSession.partnerId = null
        partnerSession.isTyping = false
      }
    }

    session.partnerId = null
    session.isTyping = false
    session.messages = []
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

      if (session.messages.length > 500) {
        session.messages = session.messages.slice(-500)
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
      const timeSinceActivity = now - session.lastActivity
      if (timeSinceActivity > this.SESSION_TIMEOUT) {
        console.log("[v0] Cleaning up inactive session - userId:", userId, "inactive for:", timeSinceActivity, "ms")
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
      } else {
        console.log("[v0] Removing stale queue entry userId:", entry.userId)
      }
    })

    this.queue = validQueue
    this.queueSet = validQueueSet

    this.matchingLock.forEach((userId) => {
      if (!this.sessions.has(userId)) {
        console.log("[v0] Removing stale lock for userId:", userId)
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
