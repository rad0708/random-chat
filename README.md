# ShuffleChat

익명 1:1 랜덤 채팅 서비스 (Next.js + Socket.IO)

## 실행 방법

### 로컬 실행
```bash
npm install
npm run dev
```

### 프로덕션 실행
```bash
npm run build
npm run start
```

### Render 배포
- Node: 20.x
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

## 환경 변수
- `PORT` (기본값: 3000)
- `ALLOWED_ORIGINS` (허용할 도메인, 쉼표 구분)
- `RATE_LIMIT_MAX` (분당 최대 요청 수, 기본 120)
