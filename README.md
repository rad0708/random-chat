# 셔플챗 (ShuffleChat)

로그인 없이 즐기는 한국어 1:1 랜덤 채팅 서비스. 큐 기반 랜덤 매칭과 Socket.IO 실시간 채팅을 제공합니다. DB 없이 **메모리만** 사용합니다.

## 주요 기능
- 익명 닉네임 자동 부여 (서버 메모리)
- 큐 기반 1:1 랜덤 매칭
- 실시간 채팅, 타이핑 표시, 연결 상태 안내
- 다음 찾기 (현재 대화 종료 후 즉시 재매칭)
- 정책 페이지(이용약관/개인정보 처리방침)
- 광고 수익화: `public/ads.txt`, `AdBanner` 컴포넌트 포함
- 보안: helmet, cors, rate-limit, bad-words, zod

## 빠른 시작 (로컬)
```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버 (Next + Socket.IO 커스텀 서버)
npm run dev    # http://localhost:3000
```

## 배포 (Render 권장)
- **Node**: 20.x
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**
  - `ALLOWED_ORIGINS` : 허용 도메인 목록 (쉼표 구분)
  - `RATE_LIMIT_MAX` : 분당 허용 요청 수 (기본 120)
  - `NEXT_PUBLIC_SOCKET_URL` : (선택) 클라이언트 소켓 URL

> Vercel은 지속 실행 Node 서버에 맞지 않으므로 Render 같은 Web Service를 권장합니다.

## 트러블슈팅 체크리스트
- `@types/socket.io-client` 불필요 → 설치 금지
- `express-rate-limit` 설치 및 `/socket.io` 경로는 skip
- `Noto_Sans_KR`는 `subsets: ['latin']` 사용
- Render에서 Sticky Sessions 또는 단일 인스턴스
- `public/ads.txt` 배치

## 라이선스
MIT
