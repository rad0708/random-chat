
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const xss = require('xss');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(helmet());
app.use(express.static('public'));

// 간단 매칭 상태
let waiting = [];
let partners = {};

io.on('connection', (socket) => {
  socket.on('find', () => {
    if (waiting.length > 0) {
      const partner = waiting.pop();
      partners[socket.id] = partner;
      partners[partner] = socket.id;
      io.to(socket.id).emit('matched', { partner: partner });
      io.to(partner).emit('matched', { partner: socket.id });
    } else {
      waiting.push(socket.id);
    }
  });

  socket.on('message', (msg) => {
    if (partners[socket.id]) {
      const cleanMsg = xss(msg);
      io.to(partners[socket.id]).emit('message', cleanMsg);
    }
  });

  socket.on('disconnect', () => {
    if (waiting.includes(socket.id)) {
      waiting = waiting.filter(id => id !== socket.id);
    }
    if (partners[socket.id]) {
      const partner = partners[socket.id];
      io.to(partner).emit('partnerLeft');
      delete partners[partner];
      delete partners[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on ' + PORT));
