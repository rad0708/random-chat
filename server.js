
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- In-memory state ---
let queue = [];              // waiting list
const partners = {};         // socketId -> partnerId
const users = {};            // socketId -> {nickname, gender, color}
const lastSeen = {};         // socketId -> timestamp (for presence)

function onlineCount() {
  // socket.io v4
  return io.engine.clientsCount || 0;
}
function broadcastOnline() {
  io.emit('online', onlineCount());
}
function safeGetSocket(id) {
  return io.sockets.sockets.get(id);
}
function pair(a, b) {
  partners[a] = b;
  partners[b] = a;
  const ua = users[a] || {};
  const ub = users[b] || {};
  io.to(a).emit('match', ub);
  io.to(b).emit('match', ua);
  io.to(a).emit('status', { kind: 'ok', text: '연결됨' });
  io.to(b).emit('status', { kind: 'ok', text: '연결됨' });
}

io.on('connection', (socket) => {
  lastSeen[socket.id] = Date.now();
  broadcastOnline();

  socket.on('join', (profile) => {
    users[socket.id] = {
      nickname: (profile && profile.nickname) || '낯선사람',
      gender: (profile && profile.gender) || 'unknown',
      color: (profile && profile.color) || '#3b82f6'
    };
    // try pair
    while (queue.length) {
      const peer = queue.shift();
      const s = safeGetSocket(peer);
      if (!s) continue;
      if (peer === socket.id) continue;
      pair(socket.id, peer);
      return;
    }
    queue.push(socket.id);
    socket.emit('status', { kind: 'wait', text: '대기 중' });
    socket.emit('system', '상대를 기다리는 중…');
  });

  socket.on('chat message', (payload) => {
    const p = partners[socket.id];
    if (!p) return;
    // payload: {type:'text'|'sticker'|'image'|'gif', text?, replyTo?}
    const msg = {
      from: users[socket.id],
      type: payload?.type || 'text',
      text: String(payload?.text || '').slice(0, 2000),
      replyTo: payload?.replyTo || null,
      ts: Date.now()
    };
    io.to(p).emit('chat message', msg);
  });

  socket.on('typing', () => {
    const p = partners[socket.id];
    if (p) io.to(p).emit('typing', users[socket.id]);
  });
  socket.on('stopTyping', () => {
    const p = partners[socket.id];
    if (p) io.to(p).emit('stopTyping');
  });

  socket.on('next', () => {
    const p = partners[socket.id];
    if (p) {
      io.to(p).emit('partner-left');
      delete partners[p];
    }
    delete partners[socket.id];

    // immediate requeue
    while (queue.length) {
      const target = queue.shift();
      if (target === socket.id) continue;
      if (!safeGetSocket(target)) continue;
      pair(socket.id, target);
      return;
    }
    queue.push(socket.id);
    socket.emit('status', { kind: 'wait', text: '대기 중' });
    socket.emit('system', '상대를 기다리는 중…');
  });

  socket.on('leave', () => {
    const p = partners[socket.id];
    if (p) {
      io.to(p).emit('partner-left');
      delete partners[p];
    }
    delete partners[socket.id];
    queue = queue.filter(id => id !== socket.id);
    delete users[socket.id];
    delete lastSeen[socket.id];
    socket.emit('status', { kind: 'wait', text: '대기 중' });
  });

  socket.on('disconnect', () => {
    const p = partners[socket.id];
    if (p) {
      io.to(p).emit('partner-left');
      delete partners[p];
    }
    delete partners[socket.id];
    queue = queue.filter(id => id !== socket.id);
    delete users[socket.id];
    delete lastSeen[socket.id];
    broadcastOnline();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Random chat server on', PORT);
});
