import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import compression from "compression";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 기본 보안/최적화
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(express.static("public"));

let waitingQueue = []; // 프로필 포함된 소켓 대기열

function pairSockets(a, b){
  a.partner = b;
  b.partner = a;
  a.emit("status", "상대와 연결됨");
  b.emit("status", "상대와 연결됨");
  a.emit("system", "상대와 연결되었습니다!");
  b.emit("system", "상대와 연결되었습니다!");
}

// 접속자 수 브로드캐스트
function broadcastUserCount(){
  io.emit("users", io.engine.clientsCount);
}

io.on("connection", (socket) => {
  broadcastUserCount();

  socket.on("ready", (profile) => {
    socket.data.profile = {
      nickname: (profile?.nickname || "손님").slice(0,16),
      gender: profile?.gender || "비공개"
    };
    socket.emit("system", "상대방을 찾는 중입니다...");
    socket.emit("status", "대기 중");

    // 대기열에 상대가 있으면 즉시 매칭
    if (waitingQueue.length > 0) {
      const partner = waitingQueue.shift();
      socket.partner = partner;
      partner.partner = socket;
      pairSockets(socket, partner);
    } else {
      waitingQueue.push(socket);
    }
  });

  socket.on("message", (text) => {
    if (!socket.partner) return;
    const clean = String(text).slice(0, 1000); // 길이 제한
    socket.partner.emit("message", { text: clean, nickname: socket.data?.profile?.nickname || "상대" });
  });

  socket.on("typing", ({ typing }) => {
    if (!socket.partner) return;
    socket.partner.emit("typing", !!typing);
  });

  socket.on("newPartner", () => {
    // 기존 파트너에게 알림
    if (socket.partner) {
      socket.partner.emit("system", "상대가 나갔습니다. 다시 대기 중…");
      socket.partner.emit("status", "대기 중");
      // 파트너를 대기열로
      socket.partner.partner = null;
      waitingQueue.unshift(socket.partner);
    } else {
      // 대기열에서 자신을 제거(이미 있으면)
      waitingQueue = waitingQueue.filter(s => s !== socket);
    }
    socket.partner = null;

    // 즉시 매칭 시도
    if (waitingQueue.length > 0) {
      const partner = waitingQueue.shift();
      socket.partner = partner;
      partner.partner = socket;
      pairSockets(socket, partner);
    } else {
      waitingQueue.push(socket);
      socket.emit("status", "대기 중");
      socket.emit("system", "새 상대를 기다리는 중…");
    }
  });

  socket.on("disconnect", () => {
    // 대기열에서 제거
    waitingQueue = waitingQueue.filter(s => s !== socket);

    if (socket.partner) {
      socket.partner.emit("system", "상대가 나갔습니다.");
      socket.partner.emit("status", "대기 중");
      socket.partner.partner = null;
      // 파트너를 대기열로 돌려놓음
      waitingQueue.unshift(socket.partner);
    }
    broadcastUserCount();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
