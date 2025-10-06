# 랜덤채팅 - 한국어판 (가벼운 편의 기능 포함)

## 포함 기능
- 한글 UI 전면 적용
- 닉네임/성별 간단 프로필 → 상대에게는 닉네임만 표시
- 1:1 대기열 매칭, 새 상대 찾기
- 상대방 입력 중 표시(typing indicator)
- 접속자 수 표시
- 다크/라이트 테마 토글 (로컬 저장)
- 소리 알림 토글 (WebAudio로 간단 비프음, 로컬 저장)
- 대화 내용 LocalStorage 저장/복원
- Shift+Enter 줄바꿈, Enter 전송
- 기본 보안/최적화(helmet, compression)

## 실행
```bash
npm install
npm start
# http://localhost:3000
```

## Render 배포 팁
- Build Command: `npm install`
- Start Command: `node server.js`
- Port 환경변수는 Render가 주입하므로 그대로 사용
