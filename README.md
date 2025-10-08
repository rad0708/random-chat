
# 랜덤채팅 Plus (캡차 포함, 한국어, DB 없음)

**익명 1:1 랜덤 텍스트 채팅** 완성형. DB 없이 서버 메모리만 사용하며, 봇 방지를 위해 **hCaptcha**를 추가했습니다.

## 필수 기능
- 자동 재매칭 옵션, 매칭 취소(대기 중), 다음/종료
- Enter 전송 / Shift+Enter 줄바꿈
- 읽음 표시, 입력 중 표시, 타임스탬프
- 대기열 인원 수 표시, 연결 상태 표시, 알림음
- 욕설/스팸 필터 + 도배 방지(레이트 리밋)
- 다크/라이트 테마 토글
- (보안) hCaptcha 통과 후에만 매칭 가능

## 실행
```bash
npm install
npm start
# http://localhost:3000
```

## Render 배포
- Build Command: `npm install`
- Start Command: `node server.js`
- **환경변수 설정**
  - `HC_SITEKEY` : hCaptcha 사이트 키
  - `HC_SECRET`  : hCaptcha 시크릿 키
- 시험용으로 환경변수를 비워두면 **테스트 키**로 동작합니다(실서비스에선 꼭 설정하세요).

## 파일 구조
```
server.js
public/
  index.html   # hCaptcha 위젯 포함
  style.css
  client.js
render.yaml     # Render 환경변수 키 포함
package.json
```

## 주의
- 서버 재시작 시 대기열/신고/차단/설정은 초기화됩니다.
- 욕설/스팸 필터는 최소 수준입니다. 필요시 `server.js`의 정규식/레이트리밋 파라미터를 조정하십시오.
- 개인정보를 공유하지 마세요.
