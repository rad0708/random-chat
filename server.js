
/**
 * Random Chat (Korean) - No DB, Socket.IO pairing
 * Features:
 *  - 익명 랜덤 1:1 텍스트 채팅
 *  - 매칭/다음(재매칭)/종료
 *  - 메시지 길이 제한 (최대 5000자)
 *  - 간단한 신고/차단(세션 내) + 욕설/스팸 필터(초간단)
 *  - 한글 UI
 *  - Render 배포 친화 (PORT 사용)
 */
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const xss = require("xss");

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
      "connect-src": ["'self'", "wss:", "https:"],
      "img-src": ["'self'", "data:"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(compression());
app.use(cors({ origin: true }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1d" }));

// Healthcheck
app.get("/healthz", (_req, res) => res.send("ok"));

// HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  pingInterval: 20000,
  pingTimeout: 30000,
});

// In-memory state (no DB)
/**
 * waiting: 아직 매칭되지 않은 소켓ID 집합
 * partners: { socketId: partnerSocketId }
 * blocked: { socketId: Set(blockedId1, blockedId2, ...) }  // 세션 내 블록
 * reports: 초간단 신고 카운트 (세션 생명주기 한정)
 */
const waiting = new Set();
const partners = new Map();
const blocked = new Map();
const reports = new Map();

// 매칭 로직
function tryMatch(socket) {
  // 이미 파트너가 있으면 무시
  if (partners.has(socket.id)) return;

  // 대기열에서 본인과 차단상태 아닌 상대를 찾음
  for (const otherId of waiting) {
    if (otherId === socket.id) continue;
    const b1 = blocked.get(socket.id);
    const b2 = blocked.get(otherId);
    if (b1 && b1.has(otherId)) continue;
    if (b2 && b2.has(socket.id)) continue;

    // 페어 성사
    waiting.delete(otherId);
    partners.set(socket.id, otherId);
    partners.set(otherId, socket.id);
    const other = io.sockets.sockets.get(otherId);
    if (other) {
      socket.emit("matched", { partner: otherId });
      other.emit("matched", { partner: socket.id });
    }
    return;
  }
  // 매칭 실패 -> 대기열에 넣음
  waiting.add(socket.id);
  socket.emit("waiting");
}

// 간단한 금지 단어 필터 (아주 기초, 한국어/영문 욕설 일부 예시)
const bannedPatterns = [
  /씨발|ㅅㅂ|좆|개새|병신|fuck|shit|bitch|asshole/i,
  /https?:\/\/[^ ]{10,}/i, // 긴 링크 스팸 억제
];

function isBadMessage(text) {
  return bannedPatterns.some((re) => re.test(text));
}

io.on("connection", (socket) => {
  socket.data.nickname = `사용자${String(Math.floor(Math.random() * 900)+100)}`;

  socket.on("find", () => {
    tryMatch(socket);
  });

  socket.on("next", () => {
    // 현재 파트너와 끊고 재매칭
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      partners.delete(socket.id);
      partners.delete(partnerId);
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        partner.emit("partner_left");
        waiting.add(partnerId); // 상대는 다시 대기열로
        tryMatch(partner);
      }
    }
    tryMatch(socket);
  });

  socket.on("send", ({ text }) => {
    if (typeof text !== "string") return;
    const trimmed = text.slice(0, 5000); // 5000자 제한
    // XSS sanitize
    const clean = xss(trimmed, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script"] }).trim();
    if (!clean) return;
    if (isBadMessage(clean)) {
      socket.emit("warn", "부적절한 메시지로 전송이 차단되었습니다.");
      return;
    }
    const to = partners.get(socket.id);
    if (!to) {
      socket.emit("warn", "아직 상대가 연결되지 않았어요. 잠시만 기다려 주세요.");
      return;
    }
    const partner = io.sockets.sockets.get(to);
    if (!partner) {
      socket.emit("partner_left");
      partners.delete(socket.id);
      return;
    }
    // 에코 본인, 전달 상대
    socket.emit("recv", { from: "me", text: clean, at: Date.now() });
    partner.emit("recv", { from: socket.data.nickname, text: clean, at: Date.now() });
  });

  socket.on("typing", (flag) => {
    const to = partners.get(socket.id);
    if (!to) return;
    const partner = io.sockets.sockets.get(to);
    if (!partner) return;
    partner.emit("typing", !!flag);
  });

  socket.on("set_nick", (nick) => {
    if (typeof nick !== "string") return;
    const clean = xss(nick.slice(0, 20));
    if (!clean) return;
    socket.data.nickname = clean;
    socket.emit("nick_ok", clean);
  });

  socket.on("report", () => {
    const to = partners.get(socket.id);
    if (!to) return;
    const count = (reports.get(to) || 0) + 1;
    reports.set(to, count);
    if (count >= 3) {
      // 3회 이상 신고되면 세션 내 강제종료
      const offender = io.sockets.sockets.get(to);
      if (offender) {
        offender.emit("banned", "여러 사용자에게 신고되어 세션이 종료되었습니다.");
        offender.disconnect(true);
      }
    } else {
      socket.emit("warn", "신고가 접수되었습니다.");
    }
  });

  socket.on("block", () => {
    const to = partners.get(socket.id);
    if (!to) return;
    if (!blocked.has(socket.id)) blocked.set(socket.id, new Set());
    blocked.get(socket.id).add(to);
    socket.emit("warn", "해당 사용자를 차단했어요. 새 상대를 찾아드릴게요.");
    // 연결 끊고 재매칭
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      partners.delete(socket.id);
      partners.delete(partnerId);
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        partner.emit("partner_left");
        waiting.add(partnerId);
        tryMatch(partner);
      }
    }
    tryMatch(socket);
  });

  socket.on("disconnect", () => {
    waiting.delete(socket.id);
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      partners.delete(socket.id);
      partners.delete(partnerId);
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) partner.emit("partner_left");
    }
    blocked.delete(socket.id);
    reports.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
