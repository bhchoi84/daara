# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

다아라 — AI 타로 & 운세 & 손금/관상 상담 서비스. 빌드 과정 없는 정적 웹앱으로, Vercel에 배포된다.

## 배포

```bash
vercel          # 프리뷰 배포
vercel --prod   # 프로덕션 배포
```

빌드 단계, 테스트, 린트 도구 없음. 변경 후 브라우저에서 직접 확인.

## 환경변수 (Vercel Dashboard → Settings → Environment Variables)

| 변수명 | 설명 |
|--------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 키 (손금/관상 + 폴백) |
| `GEMINI_API_KEY` | Google Gemini API 키 (텍스트 운세 메인) |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 (테스트: `test_sk_...` / 운영: `live_sk_...`) |

프론트엔드의 `TOSS_CLIENT_KEY` 상수는 `js/payment.js`에 있음 (테스트: `test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq`).

## 아키텍처

### 파일 구조

```
index.html        — HTML 구조만 (~250줄). CSS와 JS는 외부 파일로 분리
style.css         — 전체 CSS (다크 테마, 반응형)
js/
  cards.js        — 타로 카드 78장 데이터 (CARDS, TITLES, CARD_POS)
  payment.js      — 토스페이먼츠 결제 로직
  app.js          — 코어: 사용량 관리, 캐싱, 사용자 정보, UI 공통, API 호출, 초기화
  tarot.js        — 타로 카드 뽑기/뒤집기/해석
  fortune.js      — 운세 기능 (별자리·궁합·재물·오늘의 운세) + 손금·관상 분석
api/
  chat.js         — Vercel 서버리스 함수. ANTHROPIC_API_KEY로 Anthropic API 프록시
vercel.json       — /api/* 요청을 서버리스 함수로 라우팅
```

### 스크립트 로드 순서

`index.html` 하단에서 순서대로 로드. 빌드 도구 없이 `<script src>` 태그 사용:

1. `js/cards.js` — 순수 데이터, 의존성 없음
2. `js/payment.js` — 결제 함수 선언 (app.js 함수는 DOMContentLoaded 시점에 사용)
3. `js/app.js` — 코어 함수 + DOMContentLoaded 핸들러
4. `js/tarot.js` — 카드 뽑기 로직
5. `js/fortune.js` — 운세/손금/관상 로직

### API 호출 흐름

- 텍스트 운세: 브라우저 → `/api/gemini` (키 없음) → Gemini API (서버에서 키 주입). Gemini 실패 시 `/api/chat` → Anthropic API로 폴백.
- 손금/관상: 브라우저 → `/api/chat` (키 없음) → Anthropic API (서버에서 키 주입).
- 프론트엔드에 API 키가 노출되지 않는다.

### 모델 사용

- **`gemini-2.0-flash`** — 텍스트 기반 운세 상담 (`askClaude`, `askClaudeTarot3` in `js/app.js`). 폴백: `claude-haiku-4-5-20251001`
- **`claude-sonnet-4-6`** — 손금/관상 분석 (Vision, `analyzePalm` in `js/fortune.js`)

### 메뉴/패널 구조

각 메뉴는 `goMenu(id, el)` 함수로 전환되며, 대응하는 `#panel-{id}` DOM이 활성화된다:

| 메뉴 ID | 기능 |
|---------|------|
| `tarot` | AI 타로 상담 (채팅) + 3카드 뽑기 |
| `today` | 오늘의 운세 |
| `palm` | 손금/관상 분석 (이미지 업로드) |
| `star` | 별자리 운세 |
| `match` | 궁합 보기 |
| `money` | 금전 운세 |

운세 결과는 모두 `tarot` 패널의 채팅창(`#messages`)으로 출력된다.

### 채팅 UI 구조

메시지는 `addMsg(role, content, type)` 함수로 생성된다. 각 메시지의 DOM 구조:

```
.msg.bot / .msg.user
  ├── .msg-avatar      — 봇: ✦ (틸 아이콘), 유저: 나
  └── .msg-content
       ├── .msg-label  — 봇: "다아라" (골드), 유저: "나의 질문"
       └── .msg-bubble — 글래스모피즘 배경 + 좌측 골드 보더 (봇)
```

- 봇 버블: `backdrop-filter: blur(16px)` + 좌측 골드 보더 라인 + 좌상단 꼬리
- 유저 버블: 인디고 배경 + 우상단 꼬리
- 디자인 참조: `stitch/main/conversation.html`

### 답변 스타일링

`formatReply()` 함수 (`js/app.js`)가 API 응답을 HTML로 변환:

| 패턴 | 변환 결과 | CSS 클래스 |
|------|----------|-----------|
| `\n` | `<br>` | — |
| `**텍스트**` | 골드 볼드 | `.hl-accent` |
| 이모지 헤더 (🔮🌙⚠️✨⭐💰♡◈🌅) | 골드 헤딩 블록 | `.reply-heading` |

타로 3카드 해석은 구조화된 형식으로 출력: 🔮 오늘 → 🌙 미래 → ⚠️ 주의 → ✨ 한마디

### 타로 카드 데이터

`js/cards.js`의 `CARDS` 배열에 메이저 아르카나 22장 + 마이너 아르카나 56장 = 78장이 정의되어 있다.
결과에 `바보` 카드가 나오면 `광대`라는 단어로 변경되어야 한다.
