
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

app.get('/health', (_req,res)=>res.json({ok:true}));

io.on('connection', (socket)=>{
  console.log('connected', socket.id);
  socket.on('disconnect', ()=>console.log('disconnected', socket.id));
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.get('*', (_req,res)=>{
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, ()=>console.log('Listening on '+PORT));
