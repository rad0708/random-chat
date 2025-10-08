
/**
 * Random Chat KOR Plus (No DB) + hCaptcha - v2.1
 * 필수 기능 + 캡차 + UX 개선
 */
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const xss = require("xss");

const HC_SECRET = process.env.HC_SECRET || ""; // hCaptcha secret
const HC_SITEKEY = process.env.HC_SITEKEY || ""; // hCaptcha sitekey

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://js.hcaptcha.com"],
      "connect-src": ["'self'", "wss:", "https:"],
      "img-src": ["'self'", "data:"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "frame-src": ["https://*.hcaptcha.com"]
    },
  },
}));
app.use(compression());
app.use(cors({ origin: true }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1d" }));

// Healthcheck
app.get("/healthz", (_req, res) => res.send("ok"));

// Expose sitekey to client
app.get("/captcha/sitekey", (_req, res) => {
  res.json({ sitekey: HC_SITEKEY ? "set" : "" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  pingInterval: 20000,
  pingTimeout: 30000,
});

// In-memory state
const waiting = new Set();
const partners = new Map();
const blocked = new Map();
const reports = new Map();
const settings = new Map(); // socket.id -> { autoRematch: boolean }
const lastSeen = new Map();
const rate = new Map(); // rate limit tokens
const verified = new Set(); // passed captcha

function broadcastQueueSize(){
  io.emit("queue_size", waiting.size);
}

// Basic profanity & spam
const bannedPatterns = [
  /씨발|ㅅㅂ|좆|개새|개색|병신|븅신|닥쳐|꺼져|fuck|shit|bitch|asshole|nigger|cunt|slut|whore/i,
  /지금바로\s*클릭|성인\s*채팅|무료\s*머니|카지노|도박|토토/i,
];
const linkPattern = /https?:\/\/\S+/ig;

function isBadMessage(text) {
  const links = (text.match(linkPattern)||[]).filter(u=>u.length>120);
  if (links.length) return true;
  return bannedPatterns.some((re) => re.test(text));
}

// Token bucket: 5 msgs / 3s, burst 6
function allowSend(socketId){
  const now = Date.now();
  const cfg = rate.get(socketId) || { tokens: 6, ts: now };
  const refillBuckets = Math.floor((now - cfg.ts) / 3000);
  if (refillBuckets > 0){
    cfg.tokens = Math.min(6, cfg.tokens + refillBuckets * 5);
    cfg.ts = now;
  }
  if (cfg.tokens >= 1){
    cfg.tokens -= 1;
    rate.set(socketId,cfg);
    return true;
  }
  rate.set(socketId,cfg);
  return false;
}

function tryMatch(socket){
  if (!verified.has(socket.id)){
    socket.emit("warn","캡차 인증이 필요합니다.");
    return;
  }
  if (partners.has(socket.id)) return;

  // remove self to avoid duplicates
  waiting.delete(socket.id);
  for (const otherId of waiting){
    if (otherId === socket.id) continue;
    const b1 = blocked.get(socket.id);
    const b2 = blocked.get(otherId);
    if (b1 && b1.has(otherId)) continue;
    if (b2 && b2.has(socket.id)) continue;

    // pair
    waiting.delete(otherId);
    partners.set(socket.id, otherId);
    partners.set(otherId, socket.id);

    const other = io.sockets.sockets.get(otherId);
    if (other){
      socket.emit("matched", { partner: otherId });
      other.emit("matched", { partner: socket.id });
    }
    broadcastQueueSize();
    return;
  }
  // enqueue
  waiting.add(socket.id);
  socket.emit("waiting");
  broadcastQueueSize();
}

io.on("connection",(socket)=>{
  socket.data.nickname = `사용자${String(Math.floor(Math.random()*900)+100)}`;
  settings.set(socket.id, { autoRematch: false });

  // CAPTCHA verify
  socket.on("captcha_token", async (token) => {
    try{
      if (!HC_SECRET){
        // If not configured, allow in development/quick deploy
        verified.add(socket.id);
        socket.emit("captcha_ok", true);
        return;
      }
      if (typeof token !== "string" || token.length < 10){
        socket.emit("captcha_ok", false);
        return;
      }
      const params = new URLSearchParams();
      params.append("secret", HC_SECRET);
      params.append("response", token);
      // Use global fetch (Node 18+)
      const resp = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type":"application/x-www-form-urlencoded" },
        body: params
      });
      const data = await resp.json();
      if (data.success){
        verified.add(socket.id);
        socket.emit("captcha_ok", true);
      } else {
        socket.emit("captcha_ok", false);
      }
    } catch(e){
      socket.emit("captcha_ok", false);
    }
  });

  socket.on("find", ()=> tryMatch(socket));

  socket.on("cancel_wait", ()=>{
    waiting.delete(socket.id);
    socket.emit("idle");
    broadcastQueueSize();
  });

  socket.on("toggle_auto", (flag)=>{
    const s = settings.get(socket.id) || { autoRematch:false };
    s.autoRematch = !!flag;
    settings.set(socket.id, s);
    socket.emit("auto_ok", s.autoRematch);
  });

  socket.on("next", ()=>{
    const partnerId = partners.get(socket.id);
    if (partnerId){
      partners.delete(socket.id);
      partners.delete(partnerId);
      const partner = io.sockets.sockets.get(partnerId);
      if (partner){
        partner.emit("partner_left");
        waiting.add(partnerId);
        tryMatch(partner);
      }
    }
    tryMatch(socket);
  });

  socket.on("send", ({ text })=>{
    if (typeof text!=="string") return;
    const trimmed = text.slice(0,5000);
    const clean = xss(trimmed, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script"] }).trim();
    if (!clean) return;
    if (isBadMessage(clean)){
      socket.emit("warn","부적절한 메시지로 전송이 차단되었습니다.");
      return;
    }
    if (!allowSend(socket.id)){
      socket.emit("warn","너무 빠르게 전송하고 있어요. 잠시 후 다시 시도하세요.");
      return;
    }
    const partnerId = partners.get(socket.id);
    if (!partnerId){
      socket.emit("warn","아직 상대가 연결되지 않았어요.");
      return;
    }
    const partner = io.sockets.sockets.get(partnerId);
    if (!partner){
      socket.emit("partner_left");
      partners.delete(socket.id);
      return;
    }
    const now = Date.now();
    socket.emit("recv", { from:"me", text: clean, at: now });
    partner.emit("recv", { from: socket.data.nickname, text: clean, at: now });
  });

  socket.on("typing", (flag)=>{
    const to = partners.get(socket.id);
    if (!to) return;
    const partner = io.sockets.sockets.get(to);
    if (partner) partner.emit("typing", !!flag);
  });

  socket.on("seen", (ts)=>{
    const to = partners.get(socket.id);
    if (!to) return;
    const partner = io.sockets.sockets.get(to);
    if (!partner) return;
    partner.emit("seen", ts || Date.now());
  });

  socket.on("set_nick", (nick)=>{
    if (typeof nick!=="string") return;
    const clean = xss(nick.slice(0,20));
    if (!clean) return;
    socket.data.nickname = clean;
    socket.emit("nick_ok", clean);
  });

  socket.on("report", ()=>{
    const to = partners.get(socket.id);
    if (!to) return;
    const count = (reports.get(to)||0)+1;
    reports.set(to,count);
    socket.emit("warn","신고가 접수되었습니다.");
    if (count>=3){
      const offender = io.sockets.sockets.get(to);
      if (offender){
        offender.emit("banned","여러 사용자에게 신고되어 세션이 종료되었습니다.");
        offender.disconnect(true);
      }
    }
  });

  socket.on("block", ()=>{
    const to = partners.get(socket.id);
    if (!to) return;
    if (!blocked.has(socket.id)) blocked.set(socket.id,new Set());
    blocked.get(socket.id).add(to);
    socket.emit("warn","해당 사용자를 차단했어요. 새 상대를 찾아드릴게요.");
    const partnerId = partners.get(socket.id);
    if (partnerId){
      partners.delete(socket.id);
      partners.delete(partnerId);
      const partner = io.sockets.sockets.get(partnerId);
      if (partner){
        partner.emit("partner_left");
        waiting.add(partnerId);
        tryMatch(partner);
      }
    }
    tryMatch(socket);
  });

  socket.on("disconnect", ()=>{
    waiting.delete(socket.id);
    const partnerId = partners.get(socket.id);
    if (partnerId){
      partners.delete(socket.id);
      partners.delete(partnerId);
      const partner = io.sockets.sockets.get(partnerId);
      if (partner){
        partner.emit("partner_left");
        const s = settings.get(partner.id) || { autoRematch:false };
        if (s.autoRematch){
          waiting.add(partner.id);
          tryMatch(partner);
        }
      }
    }
    blocked.delete(socket.id);
    reports.delete(socket.id);
    settings.delete(socket.id);
    verified.delete(socket.id);
    lastSeen.delete(socket.id);
    broadcastQueueSize();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log(`Server running http://localhost:${PORT}`));
