
const path = require('path');
const express = require('express');
const http = require('http');
const compression = require('compression');
const helmet = require('helmet');
const { Server } = require('socket.io');

const app = express();
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// --- Matchmaking state ---
let queue = [];               // waiting socket ids
const partners = new Map();   // id -> partnerId
const profiles = new Map();   // id -> profile

function validSocket(id) {
  return io.sockets.sockets.get(id);
}

function pair(a, b) {
  partners.set(a, b);
  partners.set(b, a);
  const pa = profiles.get(a) || {};
  const pb = profiles.get(b) || {};
  io.to(a).emit('match', pb);
  io.to(b).emit('match', pa);
  io.to(a).emit('status', { kind: 'ok', text: '연결됨' });
  io.to(b).emit('status', { kind: 'ok', text: '연결됨' });
}

// Broadcast online count to all
function broadcastOnline() {
  const n = io.engine.clientsCount || io.sockets.sockets.size;
  io.emit('online', n);
}

io.on('connection', (socket) => {
  broadcastOnline();

  socket.on('join', (profile) => {
    profiles.set(socket.id, {
      nickname: profile?.nickname || `익명${String(Math.floor(Math.random()*900)+100)}`,
      age: profile?.age || null,
      gender: profile?.gender || 'N/A',
      interests: Array.isArray(profile?.interests) ? profile.interests.slice(0,3) : []
    });

    if (queue.length) {
      let partner = queue.shift();
      while (partner === socket.id || !validSocket(partner)) {
        partner = queue.shift();
        if (!partner) break;
      }
      if (partner && validSocket(partner)) {
        pair(socket.id, partner);
      } else {
        queue.push(socket.id);
        socket.emit('status', { kind: 'wait', text: '대기 중' });
        socket.emit('system', '상대를 기다리는 중…');
      }
    } else {
      queue.push(socket.id);
      socket.emit('status', { kind: 'wait', text: '대기 중' });
      socket.emit('system', '상대를 기다리는 중…');
    }
  });

  socket.on('chat:send', (payload) => {
    const partner = partners.get(socket.id);
    if (!partner || !validSocket(partner)) return;
    // Relay message with id for de-dup and read-receipt
    io.to(partner).emit('chat:recv', {
      id: payload?.id,
      text: payload?.text,
      time: Date.now()
    });
  });

  // read receipt: forward to original sender
  socket.on('chat:seen', (messageId) => {
    const partner = partners.get(socket.id);
    if (!partner || !validSocket(partner)) return;
    io.to(partner).emit('chat:seen-ack', messageId);
  });

  socket.on('typing', () => {
    const partner = partners.get(socket.id);
    if (partner && validSocket(partner)) io.to(partner).emit('typing');
  });
  socket.on('typing:stop', () => {
    const partner = partners.get(socket.id);
    if (partner && validSocket(partner)) io.to(partner).emit('typing:stop');
  });

  socket.on('next', () => {
    const partner = partners.get(socket.id);
    if (partner && validSocket(partner)) {
      io.to(partner).emit('partner:left');
      partners.delete(partner);
    }
    partners.delete(socket.id);

    // Remove from queue if present then push back
    queue = queue.filter(id => id !== socket.id);
    queue.push(socket.id);

    // Try immediate match
    if (queue.length >= 2) {
      const selfIdx = queue.indexOf(socket.id);
      if (selfIdx > -1) queue.splice(selfIdx,1);
      let other = queue.shift();
      while (other === socket.id || !validSocket(other)) {
        other = queue.shift();
        if (!other) break;
      }
      if (other && validSocket(other)) {
        pair(socket.id, other);
      } else {
        queue.push(socket.id);
        socket.emit('status', { kind: 'wait', text: '대기 중' });
      }
    } else {
      socket.emit('status', { kind: 'wait', text: '대기 중' });
    }
  });

  socket.on('disconnect', () => {
    const partner = partners.get(socket.id);
    if (partner && validSocket(partner)) {
      io.to(partner).emit('partner:left');
      partners.delete(partner);
    }
    partners.delete(socket.id);
    queue = queue.filter(id => id !== socket.id);
    profiles.delete(socket.id);
    broadcastOnline();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[OK] server listening on :${PORT}`);
});
