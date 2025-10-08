# 셔플챗 (ShuffleChat) — DB 없는 심플 랜덤 채팅

**셔플챗**은 로그인/DB 없이 즐기는 한국어 전용 1:1 랜덤 채팅 서비스입니다.  
실시간 소켓 매칭, 타이핑 표시, 다음 찾기 등 꼭 필요한 기능만 담아 빠르게 배포하고 운영할 수 있습니다.  
광고 수익화를 위한 `ads.txt` 파일과 광고 배너 컴포넌트(옵션)도 포함되어 있습니다.

## 주요 기능

- **익명 닉네임 자동 부여**: 접속 즉시 서버가 무작위 닉네임을 생성합니다. (메모리 관리)
- **랜덤 매칭 큐 시스템**: 대기열에 등록하고 다른 이용자와 1:1 채팅으로 연결됩니다.
- **실시간 채팅**: Socket.IO 기반 메시지 송수신, 타이핑 표시, 연결 상태 안내.
- **다음 찾기**: 언제든 대화를 종료하고 곧바로 새로운 상대를 찾을 수 있습니다.
- **정책 페이지**: 이용약관, 개인정보 처리방침 제공.
- **보안 강화**: helmet, cors, rate-limit, bad-words, zod 적용.
- **반응형 UI**: TailwindCSS 기반으로 모바일과 데스크톱 모두 최적화.
- **광고 수익화(옵션)**: `public/ads.txt` 및 `<AdBanner />` 컴포넌트 제공.

> ⚠️ **중요**: DB가 없으므로 모든 세션/메시지는 서버 메모리에서만 관리되고, 서버 재시작 시 초기화됩니다.

## 프로젝트 구조

```
├── app/                # Next.js App Router 페이지
├── components/         # UI 컴포넌트 (AdBanner 포함)
├── lib/                # 공용 유틸리티 (닉네임, zod 스키마)
├── pages/api/          # Next.js API 라우트 (health, csrf)
├── public/             # 정적 파일 (ads.txt, favicon)
├── server/             # 커스텀 Express + Socket.IO 서버
├── tailwind.config.ts  # Tailwind 설정
├── next.config.js
├── tsconfig*.json
└── README.md
```

## 로컬 실행 방법

1) **의존성 설치**
```bash
npm install
```

2) **환경 변수 설정**
```bash
cp .env.example .env
# 필요한 값으로 수정 (특히 ALLOWED_ORIGINS)
```

3) **개발 서버 실행**
```bash
npm run dev
# http://localhost:3000
```

> 개발 모드에서는 서버 콘솔에 `ShuffleChat server ready` 로그가 출력됩니다.

## 빌드 & 실행

```bash
npm run build
npm run start
```

## Render/Vercel 배포

### Render
- **Environment**: Node 20.x  
- **Build Command**: `npm install && npm run build`  
- **Start Command**: `npm run start`  
- **Env Vars**:
  - `ALLOWED_ORIGINS` : 허용 도메인 (예: `https://yourapp.onrender.com`)
  - `RATE_LIMIT_MAX` : 분당 허용 요청 수(선택)
  - `NEXT_PUBLIC_SOCKET_URL` : (필요 시) 클라이언트가 연결할 소켓 주소 (보통 생략)
  - `NEXT_PUBLIC_ADSENSE_CLIENT` / `NEXT_PUBLIC_ADSENSE_SLOT` : 광고 사용 시

### Vercel
- Vercel의 서버리스 환경에서는 **커스텀 서버(Express + Socket.IO)** 가 기본적으로 동작하지 않습니다.  
- Vercel에 배포하려면 **Serverless WebSockets** 또는 별도 Node 서버(예: Render)와 조합해 사용하세요.  
- 권장: **Render(Web Service)** 에 배포.

## 환경 변수

| 변수명 | 설명 |
| --- | --- |
| `PORT` | 서버 포트 (기본 3000) |
| `ALLOWED_ORIGINS` | CORS/Socket.IO 허용 도메인 (쉼표 구분) |
| `RATE_LIMIT_MAX` | 분당 허용 요청 수 (기본 120) |
| `NEXT_PUBLIC_SOCKET_URL` | 클라이언트에서 명시적으로 소켓 주소를 지정할 때 사용 (보통 동일 도메인) |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | 광고 클라이언트 ID(옵션) |
| `NEXT_PUBLIC_ADSENSE_SLOT` | 광고 슬롯 ID(옵션) |

## FAQ & 문제 해결

### 1) Socket.IO 연결이 되지 않아요
- `ALLOWED_ORIGINS`에 실제 배포 도메인을 추가했는지 확인하세요.
- 클라이언트에서 별도 도메인으로 소켓을 붙일 경우 `NEXT_PUBLIC_SOCKET_URL` 설정이 필요합니다.

### 2) 빌드는 되는데 Vercel에서 작동이 안 돼요
- 본 프로젝트는 **커스텀 Node 서버**가 필요합니다. Vercel 단독 배포 대신 **Render** 사용을 권장합니다.

### 3) 광고가 표시되지 않아요
- `NEXT_PUBLIC_ADSENSE_CLIENT`와 `NEXT_PUBLIC_ADSENSE_SLOT`을 설정했는지 확인하세요.
- `public/ads.txt` 파일에 실제 판매자 정보를 기입하세요.

### 4) 메시지가 저장되지 않아요
- 본 프로젝트는 **DB를 사용하지 않습니다.** 모든 데이터는 메모리에서만 관리됩니다.

## 라이선스
MIT
