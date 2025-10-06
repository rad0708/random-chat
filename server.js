const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let waiting = null;

io.on("connection", (socket) => {
  if(waiting){
    socket.partner = waiting;
    waiting.partner = socket;
    waiting.emit("message", "상대가 연결되었습니다.");
    socket.emit("message", "상대가 연결되었습니다.");
    waiting = null;
  } else {
    waiting = socket;
    socket.emit("message", "상대를 기다리는 중...");
  }

  socket.on("message", (msg) => {
    if(socket.partner) socket.partner.emit("message", msg);
  });

  socket.on("newChat", () => {
    if(socket.partner){
      socket.partner.emit("message", "상대가 나갔습니다.");
      socket.partner.partner = null;
      socket.partner = null;
    }
    if(waiting){
      socket.partner = waiting;
      waiting.partner = socket;
      waiting.emit("message", "상대가 연결되었습니다.");
      socket.emit("message", "상대가 연결되었습니다.");
      waiting = null;
    } else {
      waiting = socket;
      socket.emit("message", "상대를 기다리는 중...");
    }
  });

  socket.on("disconnect", () => {
    if(socket.partner){
      socket.partner.emit("message", "상대가 나갔습니다.");
      socket.partner.partner = null;
    } else if(waiting === socket){
      waiting = null;
    }
  });
});

app.use(express.static(__dirname));

server.listen(3000, () => {
  console.log("서버 실행 중: http://localhost:3000");
});