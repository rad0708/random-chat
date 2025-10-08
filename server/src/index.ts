
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Filter from 'bad-words';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

// Basic security & parsers
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);

// In-memory queue & room map
type WaitingUser = { socketId: string; nickname: string };
const waitingQueue: WaitingUser[] = [];
const roomBySocket = new Map<string, string>();

// Profanity filter
const filter = new Filter();

// Simple hash util (avoid storing raw IP)
function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Report API (in-memory for demo; DB wiring via Prisma can be added)
const ReportSchema = z.object({
  roomId: z.string(),
  reason: z.enum(['SPAM', 'HATE', 'SEXUAL', 'OTHER']),
  detail: z.string().optional()
});
const reports: any[] = [];
app.post('/report', (req, res) => {
  const parse = ReportSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ ok: false, error: 'Invalid payload' });
  const item = { id: uuidv4(), createdAt: Date.now(), ...parse.data };
  reports.push(item);
  res.json({ ok: true, id: item.id });
});

app.get('/admin/reports', (req, res) => {
  const pass = process.env.BASIC_PASSWORD;
  const auth = req.headers['x-admin-pass'];
  if (!pass || auth !== pass) return res.status(401).json({ ok: false });
  res.json({ ok: true, items: reports });
});

// Serve client (after build, client will be in ../client/dist)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Socket logic
io.on('connection', (socket) => {
  const ip = (socket.handshake.address || '') as string;
  const nickname = `익명${Math.floor(1000 + Math.random()*9000)}`;

  socket.on('queue:join', () => {
    // avoid duplicates
    if (!waitingQueue.find(w => w.socketId === socket.id)) {
      waitingQueue.push({ socketId: socket.id, nickname });
      socket.emit('queue:status', { queued: true });
      tryMatch();
    }
  });

  socket.on('queue:leave', () => {
    const idx = waitingQueue.findIndex(w => w.socketId === socket.id);
    if (idx >= 0) waitingQueue.splice(idx, 1);
    socket.emit('queue:status', { queued: false });
  });

  socket.on('message:send', (payload: { roomId: string; content: string }) => {
    if (!payload?.roomId || !payload?.content) return;
    if (roomBySocket.get(socket.id) !== payload.roomId) return;
    const clean = filter.clean(payload.content.toString().slice(0, 1000));
    io.to(payload.roomId).emit('message:new', { roomId: payload.roomId, senderId: socket.id, content: clean, ts: Date.now() });
  });

  socket.on('typing', (payload: { roomId: string; isTyping: boolean }) => {
    if (!payload?.roomId) return;
    socket.to(payload.roomId).emit('typing', { peerId: socket.id, isTyping: !!payload.isTyping });
  });

  socket.on('session:skip', () => {
    const roomId = roomBySocket.get(socket.id);
    if (roomId) leaveRoom(roomId);
    // requeue
    waitingQueue.push({ socketId: socket.id, nickname });
    socket.emit('queue:status', { queued: true });
    tryMatch();
  });

  socket.on('disconnect', () => {
    const idx = waitingQueue.findIndex(w => w.socketId === socket.id);
    if (idx >= 0) waitingQueue.splice(idx, 1);
    const roomId = roomBySocket.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('peer:left');
      leaveRoom(roomId);
    }
  });
});

function tryMatch() {
  while (waitingQueue.length >= 2) {
    const a = waitingQueue.shift()!;
    const b = waitingQueue.shift()!;
    const roomId = `room:${uuidv4()}`;
    roomBySocket.set(a.socketId, roomId);
    roomBySocket.set(b.socketId, roomId);
    const aSocket = io.sockets.sockets.get(a.socketId);
    const bSocket = io.sockets.sockets.get(b.socketId);
    if (!aSocket || !bSocket) continue;
    aSocket.join(roomId);
    bSocket.join(roomId);
    aSocket.emit('match:found', { roomId, peerNickname: '상대' });
    bSocket.emit('match:found', { roomId, peerNickname: '상대' });
  }
}

function leaveRoom(roomId: string) {
  for (const [sid, rid] of Array.from(roomBySocket.entries())) {
    if (rid === roomId) {
      roomBySocket.delete(sid);
      const s = io.sockets.sockets.get(sid);
      s?.leave(roomId);
    }
  }
}

const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, () => {
  console.log(`Server on :${PORT}`);
});
