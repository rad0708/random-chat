# 랜덤채팅 (DB 없음 · 광고 포함 · Render 배포)

- 백엔드: Node.js (Express) + Socket.IO
- 프론트엔드: HTML/CSS/JS (빌드 불필요)
- 보안: hCaptcha 인증 (환경변수 `HC_SITEKEY`, `HC_SECRET` 필요)
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
   - `HC_SITEKEY`: hCaptcha 사이트 키
   - `HC_SECRET` : hCaptcha 시크릿 키
6. 배포 후 도메인 접속

## 구조
```
server.js
public/
  index.html
  style.css
  script.js
render.yaml (선택)
```

## 광고 삽입
- `index.html`의 `.ad-top`, `.ad-bottom`, `.ad-mid`에 광고 스크립트나 iframe 삽입.
- 중간 광고는 대화 시작 1.5분 후 자동 노출됨(프론트에서 제어).

## 주의
- 서버/DB에 대화 내용 저장하지 않습니다.
- 안전을 위해 기본적인 금칙어/개인정보 패턴을 차단합니다.