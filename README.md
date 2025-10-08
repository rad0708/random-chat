# 셔플챗 (ShuffleChat)

**익명 1:1 랜덤 채팅** 서비스. 데이터베이스 없이 **메모리 기반**으로 동작하며, Render/Vercel에 바로 배포할 수 있습니다. (한국어 전용)

## 주요 기능
- 익명 닉네임 자동 부여 (서버에서 생성, 저장 안 함)
- 큐 기반 랜덤 매칭 (상대 없으면 대기, 들어오면 자동 매칭)
- 실시간 채팅 (Socket.IO) / 타이핑 표시 / 연결 상태 안내
- 다음 찾기 (대화 종료 후 즉시 재매칭)
- 정책 페이지 (이용약관 / 개인정보 처리방침)
- 광고 수익화 준비 (광고 배너 컴포넌트, `public/ads.txt` 포함)
- 보안 헤더(helmet), CORS, rate-limit, 욕설 필터(bad-words), 입력 검증(zod)

## 기술 스택
- Frontend: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS
- Backend: Node.js 20, Express + Socket.IO (메모리 큐)
- 품질/보안: helmet, cors, express-rate-limit, bad-words, zod

## 프로젝트 구조
```
.
├── app/                  # Next.js App Router
│   ├── api/health/route.ts
│   ├── chat/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── policies/{terms,privacy}/page.tsx
├── components/           # UI 컴포넌트 (광고/채팅버블/타이핑표시)
├── lib/                  # 유틸 (닉네임)
├── public/ads.txt        # 광고 수익화
├── server/               # Express + Socket.IO (메모리 매칭)
│   ├── index.ts
│   └── matchmaker.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── tsconfig.server.json
├── next.config.js
├── .env.example
├── .gitignore
└── package.json
```

## 로컬 실행
```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버
npm run dev
# http://localhost:3000 접속
```

## 빌드 & 실행
```bash
npm run build
npm run start
```

## Render 배포
- **Node**: 20.x
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**:
  - `ALLOWED_ORIGINS` (쉼표로 구분, 비우면 모두 허용)
  - `NEXT_PUBLIC_SOCKET_URL` (선택, 다른 도메인의 소켓 서버에 연결 시)
  - `PORT` (Render에서 자동 설정)

> 오류 예방법
> - `pages/`와 `app/` API를 같이 두지 마세요. (본 레포는 **app만** 사용)
> - 존재하지 않는 패키지 버전은 지정하지 않습니다. (`csrf-lite@^1.0.2`)

## Vercel 배포
Vercel 무료 요금제에서 **커스텀 Node 서버**는 제한적입니다. 반드시 “**Node.js Serverless Functions**”가 아닌 **Custom Server**가 필요하므로, Vercel 대신 Render 사용을 권장합니다.

## 환경 변수
`.env.example` 참고
```
ALLOWED_ORIGINS=""
# NEXT_PUBLIC_SOCKET_URL=""
PORT=3000
```

## FAQ
**Q. DB 없이 기록이 남나요?**  
A. 아니요. 본 서비스는 **메모리 기반**으로 채팅 내용이 저장되지 않습니다.

**Q. HTTPS/WSS 문제**  
- Render 도메인 사용 시 자동으로 HTTPS/WSS가 적용됩니다.
- 프론트에서 다른 도메인의 소켓에 연결하려면 `NEXT_PUBLIC_SOCKET_URL`을 설정하세요.

**Q. 광고 연결**  
- `components/AdBanner.tsx`에 실제 광고 스크립트를 삽입하세요.
- `public/ads.txt`에 퍼블리셔 정보를 등록하세요.
