
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();
const server = http.createServer(app);

const ORIGIN = process.env.ORIGIN || '*';
const PORT = process.env.PORT || 3000;

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
      "connect-src": ["'self'", ORIGIN, `ws://localhost:${PORT}`, `http://localhost:${PORT}`],
      "manifest-src": ["'self'"],
      "media-src": ["'self'", "data:"]
    }
  }
}));
app.use(compression());
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }));
app.use(express.static('public'));

const io = new Server(server, {
  cors: { origin: ORIGIN === '*' ? true : ORIGIN }
});

// In-memory state (single instance). Use Redis adapter to scale horizontally.
const waitingQueue = []; // [{ socketId, profile }]
const peers = new Map(); // socketId -> partnerSocketId
const profiles = new Map(); // socketId -> { nickname, about }

// Simple rate limit per socket
const RATE_LIMIT = { tokens: 10, refillMs: 3000 };
const buckets = new Map(); // socketId -> { tokens, last }
const getBucket = (id) => {
  const now = Date.now();
  let b = buckets.get(id);
  if (!b) { b = { tokens: RATE_LIMIT.tokens, last: now }; buckets.set(id, b); }
  const elapsed = now - b.last;
  if (elapsed > RATE_LIMIT.refillMs) {
    const refillCount = Math.floor(elapsed / RATE_LIMIT.refillMs);
    b.tokens = Math.min(RATE_LIMIT.tokens, b.tokens + refillCount * RATE_LIMIT.tokens);
    b.last = now;
  }
  return b;
};
function allow(id) { const b = getBucket(id); if (b.tokens > 0) { b.tokens--; return true; } return false; }
function safeEmit(to, event, payload) { try { io.to(to).emit(event, payload); } catch (_) {} }

function pairIfPossible() {
  while (waitingQueue.length >= 2) {
    const a = waitingQueue.shift();
    const b = waitingQueue.shift();
    if (!io.sockets.sockets.get(a.socketId)) continue;
    if (!io.sockets.sockets.get(b.socketId)) { waitingQueue.unshift(a); continue; }

    peers.set(a.socketId, b.socketId);
    peers.set(b.socketId, a.socketId);

    const roomId = `room_${nanoid(8)}`;
    io.sockets.sockets.get(a.socketId).join(roomId);
    io.sockets.sockets.get(b.socketId).join(roomId);

    const aProfile = profiles.get(a.socketId) || {};
    const bProfile = profiles.get(b.socketId) || {};

    safeEmit(a.socketId, 'matched', { roomId, partner: bProfile });
    safeEmit(b.socketId, 'matched', { roomId, partner: aProfile });
  }
}

io.on('connection', (socket) => {
  io.emit('online_count', io.engine.clientsCount);
  getBucket(socket.id);

  socket.on('join_queue', ({ profile }) => {
    profiles.set(socket.id, {
      nickname: (profile?.nickname || 'Guest').slice(0, 20),
      about: (profile?.about || '').slice(0, 80)
    });
    if (!waitingQueue.find(q => q.socketId === socket.id) && !peers.get(socket.id)) {
      waitingQueue.push({ socketId: socket.id, profile: profiles.get(socket.id) });
      safeEmit(socket.id, 'system', { text: '상대를 찾는 중…' });
      pairIfPossible();
    }
  });

  socket.on('leave_queue', () => {
    const idx = waitingQueue.findIndex(q => q.socketId === socket.id);
    if (idx >= 0) waitingQueue.splice(idx, 1);
  });

  socket.on('next', () => {
    const partnerId = peers.get(socket.id);
    if (partnerId) {
      peers.delete(socket.id);
      peers.delete(partnerId);
      safeEmit(partnerId, 'partner_left', { reason: '상대가 Next를 눌렀습니다.' });
      if (io.sockets.sockets.get(partnerId)) {
        waitingQueue.push({ socketId: partnerId, profile: profiles.get(partnerId) });
      }
    }
    if (!waitingQueue.find(q => q.socketId === socket.id)) {
      waitingQueue.push({ socketId: socket.id, profile: profiles.get(socket.id) });
      safeEmit(socket.id, 'system', { text: '새로운 상대를 찾는 중…' });
      pairIfPossible();
    }
  });

  socket.on('typing', (isTyping) => {
    const partnerId = peers.get(socket.id);
    if (partnerId) safeEmit(partnerId, 'typing', !!isTyping);
  });

  // minimal profanity mask (example), replace with robust service if needed
  const maskBadWords = (text) => {
    const bad = [/fuck/ig, /shit/ig];
    let t = text;
    bad.forEach(rx => t = t.replace(rx, (m)=>'*'.repeat(m.length)));
    return t;
  };

  socket.on('message', (msg) => {
    if (!allow(socket.id)) return;
    let text = String(msg?.text || '').trim();
    if (!text) return;
    if (text.length > 1000) return;
    text = maskBadWords(text);

    const partnerId = peers.get(socket.id);
    const message = {
      id: nanoid(10),
      text,
      ts: Date.now(),
      from: socket.id,
      replyTo: msg?.replyTo || null
    };

    safeEmit(socket.id, 'message_echo', message);
    if (partnerId) safeEmit(partnerId, 'message', message);
  });

  socket.on('message_read', (messageId) => {
    const partnerId = peers.get(socket.id);
    if (partnerId) safeEmit(partnerId, 'message_read', { id: messageId });
  });

  // Client ping to measure RTT
  socket.on('client_ping', (ts) => {
    safeEmit(socket.id, 'client_pong', ts);
  });

  socket.on('disconnect', () => {
    const idx = waitingQueue.findIndex(q => q.socketId === socket.id);
    if (idx >= 0) waitingQueue.splice(idx, 1);

    const partnerId = peers.get(socket.id);
    if (partnerId) {
      peers.delete(socket.id);
      peers.delete(partnerId);
      safeEmit(partnerId, 'partner_left', { reason: '상대가 나갔습니다.' });
      if (io.sockets.sockets.get(partnerId)) {
        waitingQueue.push({ socketId: partnerId, profile: profiles.get(partnerId) });
      }
    }

    profiles.delete(socket.id);
    buckets.delete(socket.id);
    io.emit('online_count', io.engine.clientsCount);
  });
});

server.listen(PORT, () => {
  console.log(`Random Chat server running on http://localhost:${PORT}`);
});
