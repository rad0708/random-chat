
# ShuffleChat (랜덤 1:1 채팅)

## 빠른 시작 (로컬)
1) Node 20 설치
2) 루트에서 `npm install`
3) 서버 개발 모드: `npm run dev` (server 8080, client 5173)
4) 프로덕션 빌드: `npm run build` 이후 `npm start` (서버가 정적 파일 서빙)

> 데이터베이스 없이도 동작합니다(인메모리 매칭/채팅). PostgreSQL + Prisma는 스키마만 포함되어 있고, 실제 저장 로직은 샘플 수준입니다.

## 환경변수
- `PORT` (기본 8080)
- `BASIC_PASSWORD` 관리자 조회용 헤더 `x-admin-pass` 값

## Render 배포
- 대시보드에서 Web Service 생성 → Build Command: `npm install && npm run build` → Start Command: `npm start`
- 필요 시 `DATABASE_URL` 환경변수 추가(Prisma 사용 시).

## 기능
- 1:1 랜덤 매칭(대기열)
- 실시간 메시지, 타이핑 알림
- 다음 상대 찾기
- 신고 API (인메모리)
- 반응형 UI
