// server.js — Random Chat with hCaptcha fix
const express = require("express");
const http = require("http");
const path = require("path");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

const PORT = process.env.PORT || 3000;
const HC_SECRET = process.env.HC_SECRET || "";
const HC_SITEKEY = process.env.HC_SITEKEY || "";

app.use(express.json());
app.use(express.static(path.join(__dirname,"public"),{extensions:["html"]}));

app.get("/env.js",(_,res)=>{
  res.type("application/javascript").send(`window.ENV={HC_SITEKEY:${JSON.stringify(HC_SITEKEY)}};`);
});

app.post("/verify-captcha", async (req,res)=>{
  try{
    const token=req.body?.token;
    if(!token||!HC_SECRET) return res.json({ok:false});
    const body=new URLSearchParams({response:token,secret:HC_SECRET});
    const r=await fetch("https://hcaptcha.com/siteverify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const d=await r.json();
    res.json({ok:!!d.success});
  }catch{ res.json({ok:false}); }
});

const queue=[]; const partnerOf=new Map(); const verified=new Set();

function sanitize(t){ if(typeof t!=="string") return ""; let s=t.trim(); if(s.length>100) s=s.slice(0,100); return s.replace(/[<>&]/g,m=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[m])); }
function getPartner(id){ const pid=partnerOf.get(id); return pid?io.sockets.sockets.get(pid):null; }
function enqueue(s){ if(s.connected){ queue.push(s); match(); } }
function match(){ while(queue.length>=2){ const a=queue.shift(); const b=queue.shift(); if(!a.connected||!b.connected) continue; partnerOf.set(a.id,b.id); partnerOf.set(b.id,a.id); io.to(a.id).emit("paired"); io.to(b.id).emit("paired"); } }

io.on("connection",socket=>{
  io.emit("online",io.engine.clientsCount);
  socket.on("start",p=>{ if(p?.verified){ verified.add(socket.id); enqueue(socket);} });
  socket.on("chat",p=>{ if(!verified.has(socket.id)) return; const text=sanitize(p?.text||""); if(!text) return; const partner=getPartner(socket.id); if(partner) io.to(partner.id).emit("chat",{text,ts:Date.now()}); });
  socket.on("next",()=>{ const pid=partnerOf.get(socket.id); if(pid){ const p=getPartner(socket.id); partnerOf.delete(pid); partnerOf.delete(socket.id); if(p) enqueue(p);} enqueue(socket); });
  socket.on("disconnect",()=>{ const pid=partnerOf.get(socket.id); partnerOf.delete(socket.id); verified.delete(socket.id); if(pid){ const p=getPartner(socket.id); if(p){ partnerOf.delete(p.id); enqueue(p);} } io.emit("online",io.engine.clientsCount); });
});

server.listen(PORT,()=>console.log("running on "+PORT));