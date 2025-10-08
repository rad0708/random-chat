# 셔플챗 (ShuffleChat)

익명 1:1 랜덤 채팅 웹사이트입니다. **로그인 없이 입장**, **큐 기반 매칭**, **Socket.IO 실시간 채팅**만 담은 심플한 MVP입니다.
광고 수익화를 위해 `public/ads.txt`, `AdBanner` 컴포넌트를 포함합니다. **데이터베이스는 사용하지 않습니다.**

## 주요 기능
- 랜딩 페이지(홈) + 정책 페이지(이용약관, 개인정보 처리방침)
- 서버에서 **임시 닉네임 자동 생성**
- **큐 기반 랜덤 매칭** → 자동 1:1 연결
- **실시간 채팅** (메시지 버블, 타이핑 표시, 연결 상태 안내)
- **다음 찾기** 버튼으로 즉시 재매칭
- **보안 기본기**: helmet, cors, rate-limit, zod, bad-words
- **광고**: `AdBanner` 컴포넌트, `public/ads.txt` 포함

## 기술 스택
- Next.js (App Router), React 18, TypeScript, TailwindCSS
- Node.js + Express + Socket.IO (메모리 큐)
- Render 배포 권장 (Vercel은 커스텀 서버 제한으로 비권장)

## 로컬 실행
```bash
cp .env.example .env
npm install
npm run dev
# http://localhost:3000 접속
```

## 빌드 & 실행 (프로덕션)
```bash
npm run build
npm run start
```

## Render 배포
- **Node 버전**: 20.x
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- 환경 변수:
  - `ALLOWED_ORIGINS`: 배포 도메인 (예: `https://yourapp.onrender.com`)
  - `RATE_LIMIT_MAX`: 요청 제한 (선택)
  - `NEXT_PUBLIC_SOCKET_URL`: 필요 시 소켓 전용 도메인 지정

> Vercel은 커스텀 Node 서버 사용이 제한되어 Socket.IO가 정상 동작하지 않을 수 있습니다. Render 사용을 권장합니다.

## FAQ
**Q. Vercel에서 소켓이 끊겨요.**  
A. Vercel은 장기 연결/커스텀 서버에 제약이 있어 Render/일반 VPS 배포를 권장합니다.

**Q. ads.txt 경로는?**  
A. `public/ads.txt`에 배치되어 `/ads.txt`로 서비스됩니다.

**Q. 어떤 데이터도 DB에 저장하나요?**  
A. 아니요. 모두 메모리 기반이며 서버 재시작 시 초기화됩니다.
