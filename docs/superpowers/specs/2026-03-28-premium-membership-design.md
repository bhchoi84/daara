# 프리미엄 회원 관리 시스템 설계

## 목표

localStorage 기반의 프리미엄 관리를 Vercel KV(Redis) 서버 측 관리로 전환하여 위변조를 방지하고, 기기 간 프리미엄 상태를 공유할 수 있도록 한다.

## 사용자 식별

- **이메일 기반** — 사용자 정보 모달에 이메일 필드 추가
- 별도 인증 없이 입력만으로 식별 (현 단계에서 이메일 인증은 과잉)
- 결제 시 서버에서 email + paymentKey를 묶어 KV에 저장
- 기기를 바꿔도 이메일 입력으로 프리미엄 복원 가능

## 무료 vs 프리미엄 비교

| 항목 | 무료 | 프리미엄 |
|------|------|---------|
| 일일 타로/운세 상담 | 3회 | 20회 |
| 손금/관상 분석 | 1회/일 | 5회/일 |
| 광고 인터스티셜 | 있음 | 없음 |
| 답변 깊이 | 간결 (3~6문장) | 상세 풀이 (8~12문장 + 시기별 조언) |
| AI 모델 | Haiku (동일) | Haiku (동일) |

답변 깊이 차별화는 AI 모델 변경이 아닌, 서버 측 system 프롬프트 분기로 구현한다. Sonnet 전환 대비 API 비용을 ~10배 절감.

## 요금제

| 플랜 | 가격 | 기간 | KV TTL |
|------|------|------|--------|
| 1일권 | 99원 | 24시간 | 86400초 |
| 30일권 | 1,900원 | 30일 | 2592000초 |

기존 토스페이먼츠 결제 흐름 유지. 금액 검증도 기존과 동일 (`[99, 1900]`).

## Vercel KV 데이터 구조

```
premium:{email}  →  {
  plan: "1day" | "30day",
  expiry: "2026-04-27",
  paymentKey: "toss_pay_xxx",
  orderId: "daara_20260328_abc123",
  approvedAt: "2026-03-28T14:30:00Z"
}

usage:{email}:{YYYY-MM-DD}  →  {
  count: 5,
  palm: 1
}
```

- `premium:{email}` — TTL을 플랜 기간에 맞게 설정, 만료 시 자동 삭제
- `usage:{email}:{date}` — TTL 24h, 매일 자동 리셋

## API 엔드포인트

### `POST /api/chat` (수정)

기존 Anthropic 프록시에 다음을 추가:

1. 요청 body에서 `email` 수신
2. KV에서 `premium:{email}` 조회 → 프리미엄 여부 판단
3. KV에서 `usage:{email}:{today}` 조회 → 잔여 횟수 확인 (일반 상담 `count` 또는 손금/관상 `palm` 구분)
4. 한도 초과 시 `403` 반환 (프론트에서 결제 모달 표시)
5. 프리미엄 여부에 따라 system 프롬프트 분기:
   - 무료: 기존 간결 프롬프트 (max_tokens: 500)
   - 프리미엄: 상세 풀이 프롬프트 (max_tokens: 1200)
6. 응답 후 usage count 증가 (`type` 파라미터로 `chat` / `palm` 구분)

### `POST /api/payment-confirm` (수정)

기존 토스 승인 후 다음을 추가:

1. 요청 body에서 `email` 수신
2. 토스 승인 성공 시 KV에 `premium:{email}` 저장
3. TTL 설정 (1일권: 86400초, 30일권: 2592000초)
4. 응답에 `premium: true`, `expiry` 포함

### `GET /api/user-status` (신규)

- 쿼리 파라미터: `email`
- KV에서 `premium:{email}` + `usage:{email}:{today}` 조회
- 응답: `{ isPremium, expiry, used, limit, palmUsed, palmLimit }`
- 페이지 로드 시 프론트에서 호출하여 UI 상태 동기화

## 프론트엔드 변경

### 사용자 정보 모달 (`index.html`)

- 이메일 입력 필드 추가 (이름, 생년월일, 성별 아래)
- `saveUserInfo()`에 email 파라미터 추가
- localStorage `daara_user`에 email 포함 저장

### 프리미엄 상태 관리 (`js/app.js`)

- `isPremium()` — localStorage 캐시 먼저 확인, 없으면 서버 조회 결과 사용
- `canUseAPI()` — 서버에서 받은 잔여 횟수로 판단
- 페이지 로드 시 `/api/user-status` 호출 → localStorage 캐시 갱신
- `FREE_LIMIT` → 3, `PREMIUM_LIMIT` → 20으로 변경

### API 호출 (`js/app.js`, `js/fortune.js`)

- `callAPI()`에 email을 body에 포함
- `askClaude()`에서 system 프롬프트를 서버로 이동 (프론트에서는 `system` 필드를 보내지 않고, 서버가 프리미엄 여부에 따라 프롬프트 생성)
- `analyzePalm()` (손금/관상 Vision API)도 동일하게 email 포함 + 서버에서 palm 사용량 체크
- 403 응답 시 결제 모달 표시

### 결제 흐름 (`js/payment.js`)

- `startPayment()`에서 orderId에 email 해시 포함
- `handlePaymentSuccess()`에서 email을 서버로 전송
- 성공 응답의 `expiry`를 localStorage에 캐시

### 광고 표시 (`js/app.js`, `index.html`)

- 서버에서 받은 `isPremium` 값으로 광고 DOM 토글
- 프리미엄이면 광고 인터스티셜 비표시

## 환경변수 추가

| 변수명 | 설명 |
|--------|------|
| `KV_REST_API_URL` | Vercel KV REST API URL |
| `KV_REST_API_TOKEN` | Vercel KV REST API 토큰 |

Vercel Dashboard → Storage → KV 생성 후 자동 연결됨.

## 보안 고려사항

- 이메일 인증 없이 입력만으로 식별하므로, 타인 이메일로 프리미엄 조회는 가능하나 **결제 없이 프리미엄 획득은 불가**
- 프리미엄 쓰기(저장)는 결제 승인 후 서버에서만 발생
- 사용량 증가도 서버에서만 발생 → localStorage 조작으로 횟수 우회 불가
- API 키는 기존과 동일하게 서버 환경변수에서만 관리
