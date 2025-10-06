const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let queue = [];         // 대기열
const partners = {};    // socket.id -> partnerId
const users = {};       // socket.id -> profile

function broadcastOnline(){
  const n = io.engine.clientsCount || 0;
  io.emit('online', n);
}

function pair(a, b){
  partners[a] = b;
  partners[b] = a;
  io.to(a).emit('match', users[b]);
  io.to(b).emit('match', users[a]);
  io.to(a).emit('status', {kind:'ok', text:'연결됨'});
  io.to(b).emit('status', {kind:'ok', text:'연결됨'});
}

io.on('connection', (socket)=>{
  broadcastOnline();

  socket.on('join', (profile)=>{
    users[socket.id] = profile;
    // 대기열에 누가 있으면 매칭
    if(queue.length){
      const partner = queue.shift();
      if(!io.sockets.sockets.get(partner)){ // 유실 방지
        socket.emit('system','상대를 찾는 중…');
        queue = queue.filter(id => id !== partner);
        queue.push(socket.id);
        return;
      }
      pair(socket.id, partner);
    }else{
      queue.push(socket.id);
      socket.emit('status', {kind:'wait', text:'대기 중'});
      socket.emit('system', '상대를 기다리는 중…');
    }
  });

  socket.on('chat message', (text)=>{
    const p = partners[socket.id];
    if(!p) return;
    io.to(p).emit('chat message', { user: users[socket.id], text });
  });

  socket.on('typing', ()=>{
    const p = partners[socket.id];
    if(!p) return;
    io.to(p).emit('typing', users[socket.id]);
  });
  socket.on('stopTyping', ()=>{
    const p = partners[socket.id];
    if(!p) return;
    io.to(p).emit('stopTyping');
  });

  socket.on('next', ()=>{
    const p = partners[socket.id];
    if(p){
      io.to(p).emit('partner-left');
      delete partners[p];
      queue.push(p); // 상대는 대기열로 복귀
    }
    delete partners[socket.id];
    // 본인은 즉시 다시 매칭 시도
    if(queue.length){
      const target = queue.shift();
      if(target === socket.id || !io.sockets.sockets.get(target)){
        queue.push(socket.id);
      }else{
        pair(socket.id, target);
      }
    }else{
      queue.push(socket.id);
      socket.emit('status', {kind:'wait', text:'대기 중'});
      socket.emit('system', '상대를 기다리는 중…');
    }
  });

  socket.on('leave', ()=>{
    const p = partners[socket.id];
    if(p){
      io.to(p).emit('partner-left');
      delete partners[p];
    }
    delete partners[socket.id];
    queue = queue.filter(id => id !== socket.id);
    delete users[socket.id];
    socket.emit('status', {kind:'wait', text:'대기 중'});
  });

  socket.on('disconnect', ()=>{
    const p = partners[socket.id];
    if(p){
      io.to(p).emit('partner-left');
      delete partners[p];
    }
    delete partners[socket.id];
    queue = queue.filter(id => id !== socket.id);
    delete users[socket.id];
    broadcastOnline();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log('Random chat server on', PORT);
});
