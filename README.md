# RandomChat (1:1 랜덤 채팅)

## 기능
- 대기열 기반 1:1 매칭, 새 상대 찾기
- 타이핑 표시, 신고/차단(세션 한정), 기본 비속어 마스킹
- 반응형 UI, 다크 테마, 접속자 수 표시
- Render 배포 친화적 (단일 Node.js 서버)

## 실행
```bash
npm install
npm start
```
브라우저에서 `http://localhost:3000` 접속

## Render 배포
- Build Command: `npm install`
- Start Command: `node server.js`
- Environment: Node
- Port: 3000 (Render가 자동 주입)

## 구조
```
public/
  index.html
  styles.css
  app.js
  logo.svg
server.js
package.json
```
