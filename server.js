// server.js — Polished DB-free random chat (hCaptcha + ads) for Render
const express = require("express");
const http = require("http");
const path = require("path");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 25000,
  pingInterval: 10000
});

const PORT = process.env.PORT || 3000;
const HC_SECRET = process.env.HC_SECRET || "";
const HC_SITEKEY = process.env.HC_SITEKEY || "";

// --- Security headers ---
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=()"); // prevent A/V access by default
  // Basic CSP allowing self and hcaptcha
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' https://js.hcaptcha.com 'unsafe-inline'; " +
    "connect-src 'self' https://hcaptcha.com https://*.hcaptcha.com; " +
    "img-src 'self' data: https://*.hcaptcha.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; " +
    "frame-src https://*.hcaptcha.com;"
  );
  next();
});

app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public"), { fallthrough: true, extensions: ["html"], maxAge: "1h" }));

app.get("/healthz", (_, res) => res.status(200).send("ok"));

// Serve sitekey for frontend
app.get("/env.js", (_, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("application/javascript").send(`window.ENV={HC_SITEKEY:${JSON.stringify(HC_SITEKEY)}};`);
});

// Verify hCaptcha
app.post("/verify-captcha", async (req, res) => {
  try {
    const token = req.body && req.body.token;
    if (!token || !HC_SECRET) return res.status(400).json({ ok: false });
    const body = new URLSearchParams({ response: token, secret: HC_SECRET });
    const r = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = await r.json();
    return res.json({ ok: !!data.success });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
});

// --- Memory-only state ---
const queue = [];               // waiting sockets
const partnerOf = new Map();    // socket.id -> partnerId
const verified = new Set();     // passed captcha
const lastSentAt = new Map();   // rate limit
const mutedUntil = new Map();   // temporary mute for spam
const lastTypingAt = new Map(); // typing throttle

// Safety filters
const BAD_WORDS = ["씨발","개새","자살","fuck","shit"];
const PII_PATTERNS = [
  /\b\d{2,3}-\d{3,4}-\d{4}\b/gi,
  /\b010[- ]?\d{4}[- ]?\d{4}\b/gi,
  /\b[0-9]{8,}\b/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi
];

function sanitizeText(raw) {
  if (typeof raw !== "string") return "";
  let t = raw.replace(/\r?\n/g, "\n").trim();
  if (t.length > 100) t = t.slice(0, 100); // hard cap
  t = t.replace(/[<>&]/g, m => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[m]));
  for (const w of BAD_WORDS) t = t.replace(new RegExp(w, "gi"), "※");
  for (const re of PII_PATTERNS) t = t.replace(re, "[개인정보-삭제]");
  return t;
}
const getSocketById = (id) => io.sockets.sockets.get(id) || null;
const getPartnerSocket = (id) => {
  const pid = partnerOf.get(id);
  return pid ? getSocketById(pid) : null;
};

function enqueue(s) {
  if (!s || !s.connected) return;
  queue.push(s);
  tryMatch();
}

function tryMatch() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    if (!a?.connected) { if (b?.connected) queue.unshift(b); continue; }
    if (!b?.connected) { if (a?.connected) queue.unshift(a); continue; }
    partnerOf.set(a.id, b.id);
    partnerOf.set(b.id, a.id);
    io.to(a.id).emit("paired");
    io.to(b.id).emit("paired");
    io.to(a.id).emit("system", { text: "대화가 시작되었습니다. 예의를 지켜주세요." });
    io.to(b.id).emit("system", { text: "대화가 시작되었습니다. 예의를 지켜주세요." });
  }
}

function broadcastOnline() {
  const count = io.engine.clientsCount;
  io.sockets.emit("online", count);
}

io.on("connection", (socket) => {
  broadcastOnline();

  socket.on("typing", (v) => {
    try {
      const now = Date.now();
      const last = lastTypingAt.get(socket.id) || 0;
      if (now - last < 300) return; // throttle
      lastTypingAt.set(socket.id, now);
      const p = getPartnerSocket(socket.id);
      if (!p) return;
      io.to(p.id).emit("typing", !!v);
    } catch {}
  });

  socket.on("start", (payload) => {
    try {
      if (!payload || !payload.verified) return;
      verified.add(socket.id);
      enqueue(socket);
      socket.emit("system", { text: "상대를 찾는 중..." });
    } catch {}
  });

  socket.on("chat", (payload) => {
    try {
      if (!verified.has(socket.id)) return;
      const now = Date.now();
      const until = mutedUntil.get(socket.id) || 0;
      if (now < until) return;

      const last = lastSentAt.get(socket.id) || 0;
      if (now - last < 700) {
        mutedUntil.set(socket.id, now + 1500);
        socket.emit("system", { text: "조금 천천히 입력해주세요." });
        return;
      }
      lastSentAt.set(socket.id, now);

      const text = sanitizeText(payload && payload.text || "");
      if (!text) return;
      const p = getPartnerSocket(socket.id);
      if (!p) return;
      io.to(p.id).emit("chat", { text, ts: now });
    } catch {}
  });

  socket.on("next", () => {
    try {
      const pid = partnerOf.get(socket.id);
      if (pid) {
        const p = getSocketById(pid);
        if (p?.connected) {
          partnerOf.delete(p.id);
          io.to(p.id).emit("system", { text: "상대가 나갔습니다. 새로운 상대를 찾는 중..." });
          enqueue(p);
        }
        partnerOf.delete(socket.id);
      }
      enqueue(socket);
      socket.emit("system", { text: "새로운 상대를 찾는 중..." });
    } catch {}
  });

  socket.on("disconnect", () => {
    try {
      const idx = queue.findIndex(s => s.id === socket.id);
      if (idx !== -1) queue.splice(idx, 1);
      const pid = partnerOf.get(socket.id);
      partnerOf.delete(socket.id);
      verified.delete(socket.id);
      lastSentAt.delete(socket.id);
      mutedUntil.delete(socket.id);
      lastTypingAt.delete(socket.id);
      if (pid) {
        const p = getSocketById(pid);
        if (p?.connected) {
          partnerOf.delete(p.id);
          io.to(p.id).emit("system", { text: "상대가 연결을 종료했습니다. 새로운 상대를 찾는 중..." });
          enqueue(p);
        }
      }
    } catch {}
    broadcastOnline();
  });
});

server.listen(PORT, () => console.log(`listening on :${PORT}`));