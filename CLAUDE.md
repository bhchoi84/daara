# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

다아라 — AI 타로 & 운세 상담 서비스. 빌드 과정 없는 단일 HTML 파일 앱으로, Vercel에 배포된다.

## 배포

```bash
vercel          # 프리뷰 배포
vercel --prod   # 프로덕션 배포
```

빌드 단계, 테스트, 린트 도구 없음. 변경 후 브라우저에서 직접 확인.

## 환경변수 (Vercel Dashboard → Settings → Environment Variables)

| 변수명 | 설명 |
|--------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 키 |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 (테스트: `test_sk_...` / 운영: `live_sk_...`) |

프론트엔드의 `TOSS_CLIENT_KEY` 상수는 `index.html` 스크립트 상단에 있음 (테스트: `test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq`).

## 아키텍처

파일이 3개뿐이다:

- **`index.html`** — HTML 구조 + CSS + 모든 JS 로직이 하나의 파일에 있음 (1700줄+)
- **`api/chat.js`** — Vercel 서버리스 함수. `ANTHROPIC_API_KEY` 환경변수를 읽어 Anthropic API를 프록시함
- **`vercel.json`** — `/api/*` 요청을 서버리스 함수로 라우팅

### API 호출 흐름

`index.html`에 `API_KEY` 변수가 있다 (기본값 빈 문자열). 값이 있으면 브라우저에서 Anthropic API를 직접 호출(`callAPI`), 없으면 `/api/chat` 프록시를 사용해야 한다. 실제 서비스에서는 Vercel 환경변수 `ANTHROPIC_API_KEY`에만 키를 저장해야 한다.

### 모델 사용

- **`claude-haiku-4-5-20251001`** — 텍스트 기반 운세 상담 (`askClaude`)
- **`claude-sonnet-4-6`** — 손금 분석 (Vision, 이미지 입력)

### 메뉴/패널 구조

각 메뉴는 `goMenu(id, el)` 함수로 전환되며, 대응하는 `#panel-{id}` DOM이 활성화된다:

| 메뉴 ID | 기능 |
|---------|------|
| `tarot` | AI 타로 상담 (채팅) + 3카드 뽑기 |
| `today` | 오늘의 운세 |
| `palm` | 손금 분석 (이미지 업로드) |
| `star` | 별자리 운세 |
| `match` | 궁합 보기 |
| `money` | 금전 운세 |

운세 결과는 모두 `tarot` 패널의 채팅창(`#messages`)으로 출력된다.

### 타로 카드 데이터

`CARDS` 배열에 메이저 아르카나 22장 + 마이너 아르카나 56장 = 78장이 정의되어 있다.
