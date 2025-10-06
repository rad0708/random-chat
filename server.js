import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waiting = null;

io.on("connection", (socket) => {
  socket.emit("system", "상대방을 기다리는 중...");

  if (waiting) {
    const partner = waiting;
    waiting = null;
    socket.partner = partner;
    partner.partner = socket;

    socket.emit("system", "상대방과 연결되었습니다!");
    partner.emit("system", "상대방과 연결되었습니다!");
  } else {
    waiting = socket;
  }

  socket.on("message", (msg) => {
    if (socket.partner) socket.partner.emit("message", msg);
  });

  socket.on("newPartner", () => {
    if (socket.partner) {
      socket.partner.emit("system", "상대방이 나갔습니다. 다시 대기 중...");
      waiting = socket.partner;
      socket.partner.partner = null;
    }
    socket.partner = null;
    if (waiting) {
      const partner = waiting;
      waiting = null;
      socket.partner = partner;
      partner.partner = socket;

      socket.emit("system", "새로운 상대와 연결되었습니다!");
      partner.emit("system", "새로운 상대와 연결되었습니다!");
    } else {
      waiting = socket;
      socket.emit("system", "새 상대를 기다리는 중...");
    }
  });

  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.emit("system", "상대방이 나갔습니다.");
      socket.partner.partner = null;
    } else if (waiting === socket) {
      waiting = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on " + PORT));
