import express from 'express';
import next from 'next';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Filter from 'bad-words';
import { Matchmaker, type ClientInfo } from './matchmaker';
import { generateNickname } from '../lib/nickname';
import { z } from 'zod';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOrigin = allowedOrigins.length ? allowedOrigins : true;
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 120);

async function bootstrap() {
  await app.prepare();
  const expressApp = express();

  expressApp.set('trust proxy', 1);
  expressApp.use(helmet());
  expressApp.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  expressApp.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  const server = createServer(expressApp);
  const io = new SocketIOServer(server, {
    cors: { origin: corsOrigin, credentials: true },
  });

  const matchmaker = new Matchmaker();
  const filter = new Filter();

  io.use((socket, nextMiddleware) => {
    try {
      const nickname = generateNickname();
      // 임시 세션 ID = 소켓 ID
      socket.data.sessionId = socket.id;
      socket.data.nickname = nickname;
      nextMiddleware();
    } catch (e) {
      nextMiddleware(e as Error);
    }
  });

  io.on('connection', (socket) => {
    socket.emit('session:init', { sessionId: socket.data.sessionId, nickname: socket.data.nickname });

    socket.on('queue:join', async () => {
      const client: ClientInfo = { socketId: socket.id, sessionId: socket.data.sessionId, nickname: socket.data.nickname };
      const partner = matchmaker.enqueue(client);
      if (!partner) {
        socket.emit('queue:waiting');
        return;
      }

      const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      matchmaker.registerRoom(roomId, [partner, client]);

      const partnerSocket = io.sockets.sockets.get(partner.socketId);
      if (!partnerSocket) {
        socket.emit('queue:waiting');
        return;
      }
      socket.join(roomId);
      partnerSocket.join(roomId);
      io.to(client.socketId).emit('match:found', { roomId, partnerNickname: partner.nickname });
      io.to(partner.socketId).emit('match:found', { roomId, partnerNickname: client.nickname });
    });

    socket.on('queue:leave', () => {
      matchmaker.leaveQueue(socket.id);
    });

    const MessageSchema = z.object({
      roomId: z.string().min(1),
      content: z.string().min(1).max(500),
    });

    socket.on('message:send', (payload) => {
      const parsed = MessageSchema.safeParse(payload);
      if (!parsed.success) return;
      const { roomId, content } = parsed.data;
      const room = matchmaker.getRoomBySocket(socket.id);
      if (!room || room.id !== roomId) return;

      const clean = filter.clean(content);
      io.to(roomId).emit('message:new', {
        id: `${Date.now()}-${Math.random()}`,
        roomId,
        senderId: socket.data.sessionId,
        nickname: socket.data.nickname,
        content: clean,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on('typing', (payload: { isTyping: boolean }) => {
      const room = matchmaker.getRoomBySocket(socket.id);
      if (!room) return;
      socket.to(room.id).emit('typing', { isTyping: !!payload?.isTyping, nickname: socket.data.nickname });
    });

    socket.on('session:end', () => {
      const room = matchmaker.endSession(socket.id);
      if (!room) return;
      room.clients.forEach((c) => {
        const s = io.sockets.sockets.get(c.socketId);
        s?.leave(room.id);
        if (c.socketId !== socket.id) io.to(c.socketId).emit('session:end');
      });
    });

    socket.on('disconnect', () => {
      const room = matchmaker.endSession(socket.id);
      if (room) {
        room.clients.forEach((c) => {
          if (c.socketId !== socket.id) io.to(c.socketId).emit('session:end');
        });
      }
      matchmaker.leaveQueue(socket.id);
    });
  });

  // Next.js 핸들러 (App Router API 포함)
  expressApp.all('*', (req, res) => handle(req, res));

  const port = parseInt(process.env.PORT ?? '3000', 10);
  server.listen(port, () => {
    console.log(`🚀 ShuffleChat ready on http://localhost:${port}`);
  });
}

bootstrap().catch((e) => {
  console.error('Server start failed', e);
  process.exit(1);
});
