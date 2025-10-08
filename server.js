
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const xss = require("xss");

const HC_SECRET = process.env.HC_SECRET || "";
const app = express();
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://js.hcaptcha.com"],
      "connect-src": ["'self'", "wss:", "https:"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
      "frame-src": ["https://*.hcaptcha.com"]
    }
  }
}));
app.use(compression());

app.use("/captcha", rateLimit({ windowMs: 15*60*1000, max: 120 }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1d" }));

app.get("/healthz", (_req,res)=>res.send("ok"));
app.get("/app", (_req,res)=> res.sendFile(path.join(__dirname,"public","app.html")));

const server = http.createServer(app);
const io = new Server(server, { pingInterval:20000, pingTimeout:30000 });

// In-memory state
const waiting = new Set();
const partners = new Map();
const verified = new Set();
const rate = new Map();

// Simple moderation
const banned = [/씨발|ㅅㅂ|좆|개새|병신|sex\s*cam|porn|fuck|shit|bitch/i];
const linkPattern = /https?:\/\/\S+/ig;

function bad(text){
  if (banned.some(r=>r.test(text))) return true;
  const longLinks = (text.match(linkPattern)||[]).filter(u=>u.length>120);
  return longLinks.length>0;
}

// Token bucket: 5 / 3s, burst 6
function allowSend(id){
  const now = Date.now();
  const st = rate.get(id) || { tokens:6, ts:now };
  const refill = Math.floor((now - st.ts)/3000);
  if (refill>0){
    st.tokens = Math.min(6, st.tokens + refill*5);
    st.ts = now;
  }
  if (st.tokens>=1){ st.tokens--; rate.set(id,st); return true; }
  rate.set(id,st); return false;
}

io.on("connection",(socket)=>{
  // Captcha token from client
  socket.on("captcha", async (token)=>{
    try{
      if (!HC_SECRET){ verified.add(socket.id); socket.emit("captcha_ok", true); return; }
      if (!token || token.length<10){ socket.emit("captcha_ok", false); return; }
      const params = new URLSearchParams();
      params.append("secret", HC_SECRET);
      params.append("response", token);
      const resp = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body: params
      });
      const data = await resp.json();
      if (data.success){ verified.add(socket.id); socket.emit("captcha_ok", true); }
      else socket.emit("captcha_ok", false);
    }catch(e){ socket.emit("captcha_ok", false); }
  });

  socket.on("find", ()=>{
    if (!verified.has(socket.id)){ socket.emit("toast","캡차 인증 후 이용해 주세요."); return; }
    if (waiting.size>0){
      const [p] = waiting;
      waiting.delete(p);
      partners.set(socket.id, p);
      partners.set(p, socket.id);
      io.to(socket.id).emit("matched");
      io.to(p).emit("matched");
    }else{
      waiting.add(socket.id);
      io.emit("qsize", waiting.size);
      socket.emit("waiting");
    }
  });

  socket.on("send", ({text})=>{
    if (typeof text!=="string") return;
    const clean = xss(text.slice(0,5000), { whiteList:{}, stripIgnoreTag:true }).trim();
    if (!clean) return;
    if (!allowSend(socket.id)){ socket.emit("toast","너무 빠르게 전송하고 있어요."); return; }
    if (bad(clean)){ socket.emit("toast","부적절한 메시지로 차단되었습니다."); return; }
    const pid = partners.get(socket.id);
    if (!pid){ socket.emit("toast","상대가 아직 연결되지 않았어요."); return; }
    const now = Date.now();
    socket.emit("recv",{from:"me", text:clean, at: now});
    io.to(pid).emit("recv",{from:"you", text:clean, at: now});
  });

  socket.on("next", ()=>{
    const pid = partners.get(socket.id);
    if (pid){
      partners.delete(socket.id); partners.delete(pid);
      io.to(pid).emit("left");
      waiting.add(pid);
    }
    socket.emit("waiting");
    waiting.add(socket.id);
    io.emit("qsize", waiting.size);
  });

  socket.on("disconnect", ()=>{
    waiting.delete(socket.id);
    const pid = partners.get(socket.id);
    if (pid){ partners.delete(pid); partners.delete(socket.id); io.to(pid).emit("left"); waiting.add(pid); }
    verified.delete(socket.id);
    io.emit("qsize", waiting.size);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log("Server on " + PORT));
