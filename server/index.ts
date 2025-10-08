import express from 'express'
import next from 'next'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import Filter from 'bad-words'
import { Matchmaker, type ClientInfo } from './matchmaker'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean)
const corsOrigin: any = (allowedOrigins && allowedOrigins.length > 0) ? allowedOrigins : true
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 180)

const messageSchema = z.object({ roomId: z.string().min(1), content: z.string().min(1).max(500) })
const typingSchema = z.object({ isTyping: z.boolean() })

async function bootstrap() {
  await app.prepare()
  const expressApp = express()

  expressApp.set('trust proxy', 1)
  expressApp.use(helmet())
  expressApp.use(cors({ origin: corsOrigin, credentials: true }))
  expressApp.use(rateLimit({ windowMs: 60*1000, max: rateLimitMax, standardHeaders: true, legacyHeaders: false }))

  const server = createServer(expressApp)
  const io = new SocketIOServer(server, { cors: { origin: corsOrigin, credentials: true } })

  const matchmaker = new Matchmaker()
  const filter = new Filter()

  io.use((socket, nextMiddleware) => {
    try {
      const sessionId = randomUUID()
      const adjectives = ['활발한','용감한','명랑한','반짝이는','즐거운','차분한','똑똑한','귀여운','신비한','빛나는','따뜻한','싱그러운']
      const nouns = ['다람쥐','고래','여우','부엉이','고양이','호랑이','사자','판다','토끼','너구리','수달','올빼미']
      const nickname = `${adjectives[Math.floor(Math.random()*adjectives.length)]} ${nouns[Math.floor(Math.random()*nouns.length)]}${Math.floor(Math.random()*900+100)}`
      socket.data.sessionId = sessionId
      socket.data.nickname = nickname
      nextMiddleware()
    } catch (e) {
      nextMiddleware(e as Error)
    }
  })

  io.on('connection', (socket) => {
    socket.emit('session:init', { sessionId: socket.data.sessionId, nickname: socket.data.nickname })

    socket.on('queue:join', async () => {
      const client: ClientInfo = { socketId: socket.id, sessionId: socket.data.sessionId, nickname: socket.data.nickname }
      const partner = matchmaker.enqueue(client)
      if (!partner) {
        socket.emit('queue:waiting')
        return
      }
      const roomId = randomUUID()
      matchmaker.registerRoom(roomId, [partner, client])

      const partnerSocket = io.sockets.sockets.get(partner.socketId)
      if (!partnerSocket) {
        matchmaker.endSession(client.socketId)
        socket.emit('queue:waiting')
        return
      }

      socket.join(roomId)
      partnerSocket.join(roomId)

      io.to(client.socketId).emit('match:found', { roomId, partnerNickname: partner.nickname })
      io.to(partner.socketId).emit('match:found', { roomId, partnerNickname: client.nickname })
    })

    socket.on('queue:leave', () => {
      matchmaker.leaveQueue(socket.id)
    })

    socket.on('message:send', async (payload) => {
      const parsed = messageSchema.safeParse(payload)
      if (!parsed.success) return

      const { roomId, content } = parsed.data
      const room = matchmaker.getRoomBySocket(socket.id)
      if (!room || room.id !== roomId) return

      const cleanContent = filter.clean(content)
      const msg = {
        id: randomUUID(),
        roomId,
        senderId: socket.data.sessionId as string,
        nickname: socket.data.nickname as string,
        content: cleanContent,
        createdAt: new Date().toISOString(),
      }
      io.to(roomId).emit('message:new', msg)
    })

    socket.on('typing', (payload) => {
      const parsed = typingSchema.safeParse(payload)
      if (!parsed.success) return
      const room = matchmaker.getRoomBySocket(socket.id)
      if (!room) return
      socket.to(room.id).emit('typing', { isTyping: parsed.data.isTyping, nickname: socket.data.nickname })
    })

    socket.on('session:end', () => {
      const room = matchmaker.endSession(socket.id)
      if (!room) return
      room.clients.forEach((client) => {
        const participantSocket = io.sockets.sockets.get(client.socketId)
        participantSocket?.leave(room.id)
        if (client.socketId !== socket.id) {
          io.to(client.socketId).emit('session:end')
        }
      })
    })

    socket.on('disconnect', () => {
      const room = matchmaker.endSession(socket.id)
      if (room) {
        room.clients.forEach((client) => {
          if (client.socketId !== socket.id) io.to(client.socketId).emit('session:end')
        })
      }
      matchmaker.leaveQueue(socket.id)
    })
  })

  expressApp.all('*', (req, res) => handle(req, res))

  const port = parseInt(process.env.PORT ?? '3000', 10)
  server.listen(port, () => {
    console.log(`🚀 ShuffleChat server ready on http://localhost:${port}`)
  })
}

bootstrap().catch((err) => {
  console.error('Server failed to start', err)
  process.exit(1)
})
