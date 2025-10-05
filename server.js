import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import xss from 'xss';
import sanitize from 'mongo-sanitize';

import { connectDB } from './config/db.js';
import Chat from './models/Chat.js';
import Report from './models/Report.js';
import Blacklist from './models/Blacklist.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || '*').split(','),
    methods: ['GET','POST']
  }
});

// 보안 미들웨어
app.use(helmet());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cors({ origin: (process.env.ALLOWED_ORIGINS || '*').split(',') }));

// 정적 파일
app.use(express.static('public'));

// 레이트 리밋
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.MAX_MSG_PER_MIN || 60),
});
app.use('/api/', limiter);

// MongoDB 연결
const USE_DB = String(process.env.USE_DB || '').toLowerCase() === 'true';
if (USE_DB) {
  const uri = process.env.MONGODB_URI;
  connectDB(uri).catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
}

// --- 이하 생략 (매칭 큐, 메시지, 신고 처리 등) ---
// 제가 드린 전체 server.js 코드 그대로 복사해 넣으시면 됩니다.

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
