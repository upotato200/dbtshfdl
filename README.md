# 달빛 윷마당

AI 없이 실제 플레이어 2–4명이 방 코드로 모여 즐기는 실시간 웹 윷놀이입니다.
Railway의 Node.js 서비스와 PostgreSQL에서 실행하도록 구성되어 있습니다.

## 주요 기능

- 6자리 초대 코드로 방 생성·입장
- 최소 2명, 전원 준비 시 자동 시작
- 서버에서 판정하는 도·개·걸·윷·모
- 말 업기, 상대 말 잡기, 추가 던지기, 4말 완주
- 트랜잭션 잠금으로 동시에 들어오는 게임 행동 순서 보장
- PC와 모바일 반응형 화면

## 로컬 실행

PostgreSQL을 준비하고 `.env.example`을 참고해 `DATABASE_URL`을 설정합니다.

```bash
npm install
npm run db:migrate
npm run dev
```

## Railway 배포

1. Railway에서 **Deploy from GitHub repo**로 이 저장소를 연결합니다.
2. 같은 Railway 프로젝트에 PostgreSQL 서비스를 추가합니다.
3. 웹 서비스의 Variables에 다음 참조 변수를 추가합니다.

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

4. 배포합니다. `railway.json`이 빌드, 마이그레이션, 시작 명령과
   `/api/health` 상태 확인 경로를 자동으로 적용합니다.
5. 웹 서비스의 **Settings → Networking → Generate Domain**에서 공개 주소를
   생성합니다.

## 명령

```bash
npm run build       # 프로덕션 빌드
npm run test        # 빌드 및 설정 테스트
npm run db:generate # Drizzle 스키마 변경 SQL 생성
npm run db:migrate  # PostgreSQL 테이블 준비
```
