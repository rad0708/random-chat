# 랜덤채팅 (DB 없음 · hCaptcha · 광고 슬롯 · Polished)

- 백엔드: Node.js (Express) + Socket.IO
- 프론트엔드: HTML/CSS/JS (빌드 불필요)
- 보안: hCaptcha 인증 (`HC_SITEKEY`, `HC_SECRET` 필요), 기본 보안 헤더 + 간단 CSP
- 수익화: 상단/하단 배너 + 중간 광고 카드(플레이스홀더)

## 로컬 실행
```bash
npm install
npm start
# http://localhost:3000
```

## Render 배포
1. 코드를 GitHub에 업로드
2. Render → New → Web Service → 리포지토리 연결
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. 환경변수 설정:
   - `HC_SITEKEY`: hCaptcha 사이트 키 (클라이언트 공개용)
   - `HC_SECRET` : hCaptcha 시크릿 키 (서버 검증용)
6. 배포 후 `/env.js`에서 sitekey 로딩 확인

## 구조
```
server.js
public/
  index.html
  style.css
  script.js
```

## 광고 삽입
- `index.html`의 `.ad-top`, `.ad-bottom`, `.ad-mid` 위치에 광고 스크립트/iframe 삽입
- 중간 광고는 대화 시작 1.5분 후 자동 표시 (프론트에서 제어)