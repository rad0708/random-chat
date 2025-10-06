const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let queue = [];
const partners = {};
const users = {};

function broadcastOnline() {
  const n = io.engine.clientsCount || 0;
  io.emit("online", n);
}

function pair(a, b) {
  partners[a] = b;
  partners[b] = a;
  io.to(a).emit("match", users[b]);
  io.to(b).emit("match", users[a]);
  io.to(a).emit("status", { kind: "ok", text: "상대방과 연결되었습니다 ✅" });
  io.to(b).emit("status", { kind: "ok", text: "상대방과 연결되었습니다 ✅" });
}

io.on("connection", (socket) => {
  broadcastOnline();

  socket.on("join", (profile) => {
    users[socket.id] = profile;
    if (queue.length) {
      const partner = queue.shift();
      if (!io.sockets.sockets.get(partner)) {
        queue = queue.filter((id) => id !== partner);
        queue.push(socket.id);
        return;
      }
      pair(socket.id, partner);
    } else {
      queue.push(socket.id);
      socket.emit("status", { kind: "wait", text: "대기 중입니다…" });
    }
  });

  socket.on("chat message", (text) => {
    const p = partners[socket.id];
    if (!p) return;
    io.to(p).emit("chat message", { user: users[socket.id], text });
  });

  socket.on("typing", () => {
    const p = partners[socket.id];
    if (p) io.to(p).emit("typing", users[socket.id]);
  });

  socket.on("stopTyping", () => {
    const p = partners[socket.id];
    if (p) io.to(p).emit("stopTyping");
  });

  socket.on("next", () => {
    const p = partners[socket.id];
    if (p) {
      io.to(p).emit("partner-left");
      delete partners[p];
      queue.push(p);
    }
    delete partners[socket.id];
    if (queue.length) {
      const target = queue.shift();
      if (target !== socket.id && io.sockets.sockets.get(target)) {
        pair(socket.id, target);
      } else {
        queue.push(socket.id);
      }
    } else {
      queue.push(socket.id);
      socket.emit("status", { kind: "wait", text: "대기 중입니다…" });
    }
  });

  socket.on("leave", () => {
    const p = partners[socket.id];
    if (p) {
      io.to(p).emit("partner-left");
      delete partners[p];
    }
    delete partners[socket.id];
    queue = queue.filter((id) => id !== socket.id);
    delete users[socket.id];
  });

  socket.on("disconnect", () => {
    const p = partners[socket.id];
    if (p) {
      io.to(p).emit("partner-left");
      delete partners[p];
    }
    delete partners[socket.id];
    queue = queue.filter((id) => id !== socket.id);
    delete users[socket.id];
    broadcastOnline();
  });
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log("✅ Random chat server running on", PORT);
});
