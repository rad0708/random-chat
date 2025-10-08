import express from 'express';
import next from 'next';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

async function main() {
  await app.prepare();
  const serverApp = express();
  serverApp.use(helmet());
  serverApp.use(cors({ origin: allowedOrigins }));
  serverApp.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

  const httpServer = createServer(serverApp);
  const io = new Server(httpServer, { cors: { origin: allowedOrigins } });

  io.on('connection', (socket) => {
    socket.on('message:send', (data) => {
      io.emit('message:new', { nickname: '익명', content: data.content });
    });
    socket.on('typing', ({ isTyping }) => {
      socket.broadcast.emit('typing', { isTyping });
    });
  });

  serverApp.all('*', (req, res) => handle(req, res));
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main();