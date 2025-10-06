import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import compression from "compression";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.static("public"));

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let waiting = []; // queue of sockets
const blocked = new Set(); // blocked socket ids by report (simple demo)

function broadcastOnline(){
  io.emit("onlineCount", io.engine.clientsCount || io.sockets.sockets.size);
}

function cleanText(t){
  if(typeof t !== "string") return "";
  const bad = ["시발","병신","개새","fuck","bitch"];
  let out = t.slice(0,800);
  for(const w of bad){
    const re = new RegExp(w, "gi");
    out = out.replace(re, "★".repeat(Math.min(w.length,3)));
  }
  return out;
}

io.on("connection", (socket) => {
  socket.partner = null;
  socket.lastSend = 0;

  broadcastOnline();

  socket.on("joinQueue", () => {
    // already paired?
    if(socket.partner) return;
    if(!waiting.includes(socket)) waiting.push(socket);
    tryPair();
  });

  socket.on("leaveQueue", () => {
    waiting = waiting.filter(s => s !== socket);
  });

  socket.on("newPartner", () => {
    // Inform partner and break
    if(socket.partner){
      socket.partner.emit("partnerLeft");
      socket.partner.partner = null;
      waiting.push(socket.partner);
    }
    socket.partner = null;
    if(!waiting.includes(socket)) waiting.push(socket);
    tryPair();
  });

  socket.on("typing", () => {
    if(socket.partner) socket.partner.emit("typing");
  });

  socket.on("message", (msg) => {
    const now = Date.now();
    if(now - socket.lastSend < 350){ // simple rate limit
      socket.emit("rateLimited");
      return;
    }
    socket.lastSend = now;

    if(!socket.partner) return;
    if(blocked.has(socket.partner.id) || blocked.has(socket.id)) return;
    const cleaned = cleanText(msg);
    socket.partner.emit("message", cleaned);
  });

  socket.on("report", (reason) => {
    // very naive: block partner this session
    if(socket.partner){
      blocked.add(socket.partner.id);
      socket.partner.emit("system", "신고로 인해 메시지 전송이 제한되었습니다.");
      socket.emit("system", "해당 사용자를 차단했습니다.");
    }
  });

  socket.on("disconnect", () => {
    waiting = waiting.filter(s => s !== socket);
    if(socket.partner){
      socket.partner.emit("partnerLeft");
      socket.partner.partner = null;
      if(!waiting.includes(socket.partner)) waiting.push(socket.partner);
    }
    broadcastOnline();
  });

  function tryPair(){
    // remove any disconnected
    waiting = waiting.filter(s => s.connected && !s.partner);
    while(waiting.length >= 2){
      const a = waiting.shift();
      const b = waiting.shift();
      if(!a.connected || !b.connected) continue;
      a.partner = b; b.partner = a;
      a.emit("paired"); b.emit("paired");
      a.emit("system", "상대와 연결되었습니다!");
      b.emit("system", "상대와 연결되었습니다!");
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("RandomChat server on " + PORT));
