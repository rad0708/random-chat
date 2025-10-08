import express from 'express';
import next from 'next';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Filter from 'bad-words';
import { randomUUID } from 'crypto';
import { Matchmaker, type ClientInfo } from './matchmaker';
import { generateNickname } from '../lib/nickname';
import { messageSchema, typingSchema } from '../lib/validators';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
const corsOrigin = allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true;
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

  io.use(async (socket, nextMiddleware) => {
    try {
      const nickname = generateNickname();
      const sessionId = randomUUID();
      socket.data.sessionId = sessionId;
      socket.data.nickname = nickname;
      nextMiddleware();
    } catch (error) {
      nextMiddleware(error as Error);
    }
  });

  io.on('connection', (socket) => {
    socket.emit('session:init', { sessionId: socket.data.sessionId, nickname: socket.data.nickname });

    socket.on('queue:join', async () => {
      const client: ClientInfo = {
        socketId: socket.id,
        sessionId: socket.data.sessionId,
        nickname: socket.data.nickname,
      };
      const partner = matchmaker.enqueue(client);
      if (!partner) {
        socket.emit('queue:waiting');
        return;
      }

      try {
        const roomId = matchmaker.createRoomId();
        matchmaker.registerRoom(roomId, [partner, client]);

        const partnerSocket = io.sockets.sockets.get(partner.socketId);
        if (!partnerSocket) {
          matchmaker.endSession(client.socketId);
          socket.emit('queue:waiting');
          return;
        }

        socket.join(roomId);
        partnerSocket.join(roomId);

        io.to(client.socketId).emit('match:found', { roomId, partnerNickname: partner.nickname });
        io.to(partner.socketId).emit('match:found', { roomId, partnerNickname: client.nickname });
      } catch (error) {
        console.error('Room creation failed', error);
        socket.emit('queue:waiting');
      }
    });

    socket.on('queue:leave', () => {
      matchmaker.leaveQueue(socket.id);
    });

    socket.on('message:send', async (payload) => {
      const parsed = messageSchema.safeParse(payload);
      if (!parsed.success) return;

      const { roomId, content } = parsed.data;
      const room = matchmaker.getRoomBySocket(socket.id);
      if (!room || room.id !== roomId) return;

      const cleanContent = filter.clean(content);
      const message = {
        id: randomUUID(),
        roomId,
        senderId: socket.data.sessionId as string,
        nickname: socket.data.nickname as string,
        content: cleanContent,
        createdAt: new Date().toISOString(),
      };

      io.to(roomId).emit('message:new', message);
    });

    socket.on('typing', (payload) => {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = matchmaker.getRoomBySocket(socket.id);
      if (!room) return;
      socket.to(room.id).emit('typing', { isTyping: parsed.data.isTyping, nickname: socket.data.nickname });
    });

    socket.on('session:end', () => {
      const room = matchmaker.endSession(socket.id);
      if (!room) return;
      room.clients.forEach((client) => {
        const participantSocket = io.sockets.sockets.get(client.socketId);
        participantSocket?.leave(room.id);
        if (client.socketId !== socket.id) {
          io.to(client.socketId).emit('session:end');
        }
      });
    });

    socket.on('disconnect', () => {
      const room = matchmaker.endSession(socket.id);
      if (room) {
        room.clients.forEach((client) => {
          if (client.socketId !== socket.id) {
            io.to(client.socketId).emit('session:end');
          }
        });
      }
      matchmaker.leaveQueue(socket.id);
    });
  });

  expressApp.all('*', (req, res) => handle(req, res));

  const port = parseInt(process.env.PORT ?? '3000', 10);
  server.listen(port, () => {
    console.log(`🚀 ShuffleChat server ready on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Server failed to start', error);
  process.exit(1);
});
