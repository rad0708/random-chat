const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let queue = [];
let rooms = {};
let users = {};

io.on('connection', (socket) => {
  socket.on('join', ({ nickname, gender }) => {
    users[socket.id] = { nickname, gender };
    if (queue.length > 0) {
      const partner = queue.shift();
      const room = socket.id + '#' + partner;
      rooms[socket.id] = partner;
      rooms[partner] = socket.id;
      socket.join(room);
      io.to(partner).socketsJoin(room);
      io.to(room).emit('system message', '새로운 상대와 연결되었습니다.');
      io.to(room).emit('status', '🟢 연결됨');
    } else {
      queue.push(socket.id);
      socket.emit('system message', '상대를 기다리는 중...');
      socket.emit('status', '🟡 대기 중');
    }
  });

  socket.on('chat message', (msg) => {
    const partner = rooms[socket.id];
    if (partner) {
      io.to(partner).emit('chat message', { user: users[socket.id].nickname, msg });
    }
  });

  socket.on('typing', () => {
    const partner = rooms[socket.id];
    if (partner) {
      io.to(partner).emit('typing', users[socket.id].nickname);
    }
  });

  socket.on('stopTyping', () => {
    const partner = rooms[socket.id];
    if (partner) {
      io.to(partner).emit('stopTyping');
    }
  });

  socket.on('new', () => {
    const partner = rooms[socket.id];
    if (partner) {
      io.to(partner).emit('system message', '상대방이 나갔습니다.');
      delete rooms[partner];
    }
    delete rooms[socket.id];
    queue.push(socket.id);
    socket.emit('system message', '새 상대를 기다리는 중...');
    socket.emit('status', '🟡 대기 중');
  });

  socket.on('leave', () => {
    const partner = rooms[socket.id];
    if (partner) {
      io.to(partner).emit('system message', '상대방이 홈으로 돌아갔습니다.');
      delete rooms[partner];
    }
    delete rooms[socket.id];
  });

  socket.on('disconnect', () => {
    const partner = rooms[socket.id];
    if (partner) {
      io.to(partner).emit('system message', '상대방이 연결을 종료했습니다.');
      delete rooms[partner];
    }
    queue = queue.filter(id => id !== socket.id);
    delete rooms[socket.id];
    delete users[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
