
# 랜덤채팅 (한국어, DB 없음)

간단한 익명 1:1 랜덤 텍스트 채팅 웹앱입니다. 데이터베이스 없이 **서버 메모리**만 사용합니다.
GitHub에 올린 뒤 **Render**로 바로 배포할 수 있습니다.

## 특징
- 한글화 UI
- 텍스트 채팅 전용(카메라/음성 없음)
- 1:1 랜덤 매칭, 다음/종료, 신고/차단
- 메시지 입력 **최대 5000자**
- 초간단 욕설/스팸 필터
- XSS 방지 처리
- DB 없음 → 기록이 남지 않음(브라우저를 닫으면 대화 종료)

## 로컬 실행
```bash
npm install
npm start
# http://localhost:3000
```

## Render 배포
1. 이 리포지토리를 GitHub에 푸시
2. Render > New Web Service > GitHub 리포 선택
3. Build Command: `npm install`, Start Command: `node server.js` (이미 `render.yaml` 포함)
4. 배포 후 도메인 접속

## 구조
```
server.js        # Express + Socket.IO 서버
public/
  index.html     # 한글 UI
  style.css
  client.js
render.yaml      # Render 설정
package.json
```

## 주의
- 서버가 재시작되면 대기열/신고/차단 정보가 초기화됩니다.
- 악용 방지를 위해 공격적 단어, 긴 링크 도배를 제한합니다. 필요시 `server.js`의 `bannedPatterns` 수정.
```

