import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import xss from 'xss';
import sanitize from 'mongo-sanitize';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from './config/db.js';
import Chat from './models/Chat.js';
import Report from './models/Report.js';
import Blacklist from './models/Blacklist.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: process.env.ORIGIN?.split(',') || '*', methods:['GET','POST'] } });

app.use(helmet());
app.use(cors({ origin: process.env.ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json({ limit:'200kb' }));
app.use(cookieParser());
app.use(morgan('tiny'));
const restLimiter = rateLimit({ windowMs: 15*60*1000, limit: 400 });
app.use('/api/', restLimiter);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.get('/healthz', (req,res)=>res.json({ ok:true }));

const waiting = [];
const rooms = new Map();
const compatible = (a,b)=> ((a.pref==='any'||a.pref===b.gender) && (b.pref==='any'||b.pref===a.gender));
const matchOrQueue = (client)=>{
  for (let i=0;i<waiting.length;i++){
    const w = waiting[i];
    if (w.id===client.id) continue;
    if (compatible(client, w)){
      waiting.splice(i,1);
      const roomId = uuidv4();
      rooms.set(roomId, { aSocketId: client.id, bSocketId: w.id });
      io.to(client.id).emit('matched', { roomId, peerHash: w.id.slice(-10) });
      io.to(w.id).emit('matched', { roomId, peerHash: client.id.slice(-10) });
      return;
    }
  }
  waiting.push(client);
};

io.on('connection', (socket)=>{
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  socket.on('find_partner', async (payload)=>{
    const banned = await Blacklist.findOne({ ipHash: String(ip), active: true }).lean();
    if (banned) { socket.emit('sys', '접속이 제한된 IP입니다.'); return; }
    const nickname = sanitize(String(payload?.nickname || '게스트').slice(0,20));
    const gender = ['male','female','unknown'].includes(payload?.gender) ? payload.gender : 'unknown';
    const pref = ['male','female','any'].includes(payload?.preference) ? payload.preference : 'any';
    socket.data.profile = { nickname, gender, pref };
    matchOrQueue({ id: socket.id, gender, pref, nickname });
    socket.emit('sys','상대를 찾고 있습니다...');
  });
  socket.on('cancel_wait', ()=>{
    const idx = waiting.findIndex(w=>w.id===socket.id);
    if (idx>=0) waiting.splice(idx,1);
    socket.emit('sys','대기 취소되었습니다.');
  });
  socket.on('skip', ()=>{
    for (const [rid, pair] of rooms){
      if (pair.aSocketId===socket.id || pair.bSocketId===socket.id){
        const other = pair.aSocketId===socket.id ? pair.bSocketId : pair.aSocketId;
        io.to(other).emit('room_closed');
        rooms.delete(rid);
      }
    }
    const profile = socket.data.profile || { nickname:'게스트', gender:'unknown', pref:'any' };
    matchOrQueue({ id: socket.id, gender: profile.gender, pref: profile.pref, nickname: profile.nickname });
    socket.emit('sys','새로운 상대를 찾는 중...');
  });
  const msgState={count:0, ts:Date.now()};
  socket.on('message', async (text)=>{
    const now=Date.now(); if (now - msgState.ts > 4000){ msgState.ts=now; msgState.count=0; }
    if (++msgState.count > 8){ socket.emit('sys','너무 빠르게 보내고 있어요.'); return; }
    text = String(text||'').slice(0,600); const safe = xss(text);
    let roomId=null, otherId=null;
    for (const [rid,pair] of rooms){
      if (pair.aSocketId===socket.id){ roomId=rid; otherId=pair.bSocketId; break; }
      if (pair.bSocketId===socket.id){ roomId=rid; otherId=pair.aSocketId; break; }
    }
    if (!roomId || !io.sockets.sockets.get(otherId)){ socket.emit('sys','상대 연결이 없습니다.'); return; }
    io.to(otherId).emit('peer_message', safe);
    try{
      await Chat.updateOne(
        { roomId },
        { $setOnInsert:{ roomId, users:[{hash:socket.id.slice(-10)},{hash:otherId.slice(-10)}], startedAt:new Date() },
          $push:{ messages:{ senderHash: socket.id.slice(-10), text: safe, at: new Date() } } },
        { upsert:true }
      );
    }catch(e){ console.error('Chat persist error', e.message); }
  });
  socket.on('report', async ({roomId, peerHash, reason})=>{
    try{
      await Report.create({ reporterHash: socket.id.slice(-10), targetHash:String(peerHash||'').slice(-10), roomId:String(roomId||''), reason:String(reason||'').slice(0,200) });
    }catch(e){ console.error('report error', e.message); }
  });
  socket.on('disconnect', ()=>{
    const idx = waiting.findIndex(w=>w.id===socket.id);
    if (idx>=0) waiting.splice(idx,1);
    for (const [rid,pair] of rooms){
      if (pair.aSocketId===socket.id || pair.bSocketId===socket.id){
        const other = pair.aSocketId===socket.id ? pair.bSocketId : pair.aSocketId;
        io.to(other).emit('room_closed'); rooms.delete(rid);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
await connectDB();
server.listen(PORT, ()=> console.log('🚀 Listening on :'+PORT) );