
/**
 * Random Chat Modern (No DB) - v3
 * - Google-like minimal UI/UX (frontend)
 * - hCaptcha gate before matching
 * - In-memory queue/pairs, no persistence
 * - Basic moderation & token-bucket anti-flood
 */
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss");

const HC_SECRET = process.env.HC_SECRET || "";
const HC_SITEKEY = process.env.HC_SITEKEY || "";

const app = express();
app.set("trust proxy", 1);

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

// Basic rate limit on HTTP
app.use("/captcha", rateLimit({ windowMs: 15 * 60 * 1000, max: 120 }));

app.use(express.static(path.join(__dirname, "public"), { maxAge: "1d" }));

app.get("/healthz", (_req,res)=>res.send("ok"));
app.get("/captcha/sitekey", (_req,res)=>{
  // Return a flag so client can render either provided key or fallback test key
  res.json({ provided: !!HC_SITEKEY });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  pingInterval: 20000,
  pingTimeout: 30000,
});

// State (in-memory)
const waiting = new Set();
const partners = new Map();
const settings = new Map(); // { autoRematch, sound }
const blocked = new Map();
const reports = new Map();
const verified = new Set();
const rate = new Map(); // token bucket

function broadcastQueueSize(){
  io.emit("queue_size", waiting.size);
}

// Moderation
const bannedPatterns = [
  /씨발|ㅅㅂ|좆|개새|병신|븅신|닥쳐|꺼져|sex\s*cam|porn|fuck|shit|bitch|asshole|nigger|cunt|slut|whore/i,
  /카지노|토토|도박|홍보\s*링크|에로|성인\s*채팅/i,
];
const linkPattern = /https?:\/\/\S+/ig;

function isBadMessage(text){
  const longLinks = (text.match(linkPattern)||[]).filter(u=>u.length>120);
  if (longLinks.length) return true;
  return bannedPatterns.some((re)=>re.test(text));
}

// Token bucket per-socket: 5 msgs per 3s, burst 6
function allowSend(socketId){
  const now = Date.now();
  const st = rate.get(socketId) || { tokens: 6, ts: now };
  const refillSlots = Math.floor((now - st.ts) / 3000);
  if (refillSlots > 0){
    st.tokens = Math.min(6, st.tokens + refillSlots * 5);
    st.ts = now;
  }
  if (st.tokens >= 1){
    st.tokens -= 1;
    rate.set(socketId, st);
    return true;
  }
  rate.set(socketId, st);
  return false;
}

function tryMatch(socket){
  if (!verified.has(socket.id)){
    socket.emit("toast", { type:"warn", text:"캡차 인증이 필요합니다." });
    return;
  }
  if (partners.has(socket.id)) return;

  // Ensure not duplicated
  waiting.delete(socket.id);
  for (const otherId of waiting){
    if (otherId === socket.id) continue;
    const bl = blocked.get(socket.id);
    const bl2 = blocked.get(otherId);
    if (bl && bl.has(otherId)) continue;
    if (bl2 && bl2.has(socket.id)) continue;

    waiting.delete(otherId);
    partners.set(socket.id, otherId);
    partners.set(otherId, socket.id);

    const other = io.sockets.sockets.get(otherId);
    if (other){
      socket.emit("matched");
      other.emit("matched");
    }
    broadcastQueueSize();
    return;
  }
  waiting.add(socket.id);
  socket.emit("waiting");
  broadcastQueueSize();
}

io.on("connection",(socket)=>{
  settings.set(socket.id, { autoRematch: true, sound: "default" });

  // Captcha verify
  socket.on("captcha_token", async (token)=>{
    try{
      if (!HC_SECRET){
        // Dev/test: allow when secret not configured (but recommend setting it in prod)
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
      const resp = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type":"application/x-www-form-urlencoded" },
        body: params
      });
      const data = await resp.json();
      if (data.success){
        verified.add(socket.id);
        socket.emit("captcha_ok", true);
      }else{
        socket.emit("captcha_ok", false);
      }
    }catch(e){
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
    const s = settings.get(socket.id) || { autoRematch:true, sound:"default" };
    s.autoRematch = !!flag;
    settings.set(socket.id, s);
    socket.emit("auto_ok", s.autoRematch);
  });
  socket.on("set_sound", (mode)=>{
    const s = settings.get(socket.id) || { autoRematch:true, sound:"default" };
    s.sound = (mode==="off") ? "off" : "default";
    settings.set(socket.id, s);
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
    const clean = xss(trimmed, { whiteList:{}, stripIgnoreTag:true, stripIgnoreTagBody:["script"] }).trim();
    if (!clean) return;
    if (isBadMessage(clean)){
      socket.emit("toast",{ type:"warn", text:"부적절한 메시지로 전송이 차단되었습니다." });
      return;
    }
    if (!allowSend(socket.id)){
      socket.emit("toast",{ type:"warn", text:"너무 빠르게 전송하고 있어요. 잠시 후 다시 시도하세요." });
      return;
    }
    const partnerId = partners.get(socket.id);
    if (!partnerId){
      socket.emit("toast",{ type:"info", text:"아직 상대가 연결되지 않았어요." });
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
    partner.emit("recv", { from:"you", text: clean, at: now });
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

  socket.on("report", ()=>{
    const to = partners.get(socket.id);
    if (!to) return;
    const count = (reports.get(to)||0)+1;
    reports.set(to,count);
    socket.emit("toast",{ type:"info", text:"신고가 접수되었습니다." });
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
    socket.emit("toast",{ type:"info", text:"해당 사용자를 차단했어요. 새 상대를 찾아드릴게요." });
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
        const s = settings.get(partner.id) || { autoRematch:true };
        if (s.autoRematch){
          waiting.add(partner.id);
          tryMatch(partner);
        }
      }
    }
    settings.delete(socket.id);
    verified.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log(`Server running http://localhost:${PORT}`));
