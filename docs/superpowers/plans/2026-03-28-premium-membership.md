# 프리미엄 회원 관리 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** localStorage 기반 프리미엄 관리를 Vercel KV(Redis) 서버 측으로 전환하여 위변조를 방지하고 기기 간 프리미엄 공유를 가능하게 한다.

**Architecture:** 프론트에서 이메일을 수집하고, 서버(Vercel Serverless + KV)에서 프리미엄 상태와 사용량을 관리한다. 프론트 localStorage는 캐시 역할만 하며, 모든 권한 판단은 서버에서 이루어진다.

**Tech Stack:** Vercel KV (@vercel/kv), Vercel Serverless Functions, 토스페이먼츠 SDK, Anthropic API

---

## File Structure

```
수정:
  index.html              — 사용자 모달에 이메일 필드 추가, 결제 모달 프리미엄 혜택 문구 업데이트
  js/app.js               — 이메일 저장, 서버 기반 프리미엄/사용량 관리, system 프롬프트 제거
  js/payment.js           — 결제 시 email 전송, 서버 응답으로 프리미엄 캐시
  js/fortune.js           — analyzePalm()에서 email 포함 + palm 타입 전달
  api/chat.js             — KV 기반 프리미엄 검증, 사용량 관리, 프롬프트 분기
  api/payment-confirm.js  — 결제 승인 후 KV에 프리미엄 저장

신규:
  api/user-status.js      — 이메일로 프리미엄 여부 + 잔여 횟수 조회
  api/_kv.js              — KV 헬퍼 (공통 키 생성, 조회/저장 래퍼)
```

---

### Task 1: KV 헬퍼 모듈 생성 (`api/_kv.js`)

**Files:**
- Create: `api/_kv.js`

- [ ] **Step 1: @vercel/kv 패키지 설치**

```bash
npm install @vercel/kv
```

`package.json`이 없으면 먼저 `npm init -y`를 실행한다.

- [ ] **Step 2: KV 헬퍼 모듈 작성**

```js
// api/_kv.js
import { kv } from '@vercel/kv';

export function premiumKey(email) {
  return `premium:${email.toLowerCase().trim()}`;
}

export function usageKey(email, date) {
  return `usage:${email.toLowerCase().trim()}:${date}`;
}

export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export async function getPremium(email) {
  return kv.get(premiumKey(email));
}

export async function setPremium(email, data, ttlSeconds) {
  await kv.set(premiumKey(email), data, { ex: ttlSeconds });
}

export async function getUsage(email) {
  const key = usageKey(email, getToday());
  return (await kv.get(key)) || { count: 0, palm: 0 };
}

export async function incrementUsage(email, type = 'chat') {
  const key = usageKey(email, getToday());
  const usage = (await kv.get(key)) || { count: 0, palm: 0 };
  if (type === 'palm') {
    usage.palm += 1;
  } else {
    usage.count += 1;
  }
  await kv.set(key, usage, { ex: 86400 });
  return usage;
}

export function getLimits(isPremium) {
  return isPremium
    ? { chatLimit: 20, palmLimit: 5 }
    : { chatLimit: 3, palmLimit: 1 };
}
```

- [ ] **Step 3: Commit**

```bash
git add api/_kv.js package.json package-lock.json
git commit -m "feat: add Vercel KV helper module for premium/usage management"
```

---

### Task 2: `GET /api/user-status` 엔드포인트 생성

**Files:**
- Create: `api/user-status.js`

- [ ] **Step 1: user-status 엔드포인트 작성**

```js
// api/user-status.js
import { getPremium, getUsage, getLimits, getToday } from './_kv.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const premium = await getPremium(email);
    const isPremium = !!premium && premium.expiry >= getToday();
    const usage = await getUsage(email);
    const limits = getLimits(isPremium);

    return res.status(200).json({
      isPremium,
      expiry: premium?.expiry || null,
      plan: premium?.plan || null,
      used: usage.count,
      limit: limits.chatLimit,
      palmUsed: usage.palm,
      palmLimit: limits.palmLimit,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/user-status.js
git commit -m "feat: add /api/user-status endpoint for premium and usage lookup"
```

---

### Task 3: `POST /api/chat` 수정 — KV 기반 프리미엄 검증 + 프롬프트 분기

**Files:**
- Modify: `api/chat.js`

- [ ] **Step 1: chat.js에 KV 검증, 사용량 관리, 프롬프트 분기 추가**

`api/chat.js`를 아래 내용으로 교체:

```js
// api/chat.js
import { getPremium, getUsage, incrementUsage, getLimits, getToday } from './_kv.js';

const FREE_SYSTEM = `당신은 따뜻하고 섬세한 AI 타로·운세 상담사 '다아라'입니다.
사용자 감정에 먼저 공감해 주세요. 친한 언니처럼 따뜻하고 공감 어린 존댓말을 씁니다.
사용자의 이름, 별자리, 나이, 성별을 자연스럽게 반영해 개인화된 답변을 해주세요.
"~것 같아요", "~할 수 있어요" 처럼 단정 짓지 않고 부드럽게 표현합니다.
이모지를 1~2개 자연스럽게 씁니다. 3~6문장 내외로 간결하고 따뜻하게 마무리합니다.
답변은 항상 같은 사용자에 대한 일관된 흐름을 유지해 주세요.`;

const PREMIUM_SYSTEM = `당신은 따뜻하고 섬세한 AI 타로·운세 상담사 '다아라'입니다.
사용자 감정에 먼저 공감해 주세요. 친한 언니처럼 따뜻하고 공감 어린 존댓말을 씁니다.
사용자의 이름, 별자리, 나이, 성별을 자연스럽게 반영해 개인화된 답변을 해주세요.
"~것 같아요", "~할 수 있어요" 처럼 단정 짓지 않고 부드럽게 표현합니다.
이모지를 1~2개 자연스럽게 씁니다.

[프리미엄 상세 풀이 모드]
- 8~12문장으로 깊이 있게 풀어주세요.
- 시기별 조언(이번 주, 이번 달)을 포함해 주세요.
- 구체적인 행동 가이드를 제시해 주세요. (예: "수요일쯤 중요한 연락이 올 수 있어요")
- 감정적 공감 + 현실적 조언을 균형 있게 담아주세요.
- 마지막에 따뜻한 응원 메시지로 마무리해 주세요.
답변은 항상 같은 사용자에 대한 일관된 흐름을 유지해 주세요.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  const { model, max_tokens, system, messages, email, type, userContext } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // email이 없으면 기존 동작 유지 (하위 호환)
  let isPremium = false;
  let serverSystem = system; // 프론트에서 보낸 system 우선 (손금/관상용)
  let serverMaxTokens = max_tokens || 500;

  if (email) {
    try {
      const premium = await getPremium(email);
      isPremium = !!premium && premium.expiry >= getToday();
      const usage = await getUsage(email);
      const limits = getLimits(isPremium);
      const usageType = type || 'chat';
      const currentUsage = usageType === 'palm' ? usage.palm : usage.count;
      const currentLimit = usageType === 'palm' ? limits.palmLimit : limits.chatLimit;

      if (currentUsage >= currentLimit) {
        return res.status(403).json({
          error: 'limit_exceeded',
          used: currentUsage,
          limit: currentLimit,
          isPremium,
        });
      }

      // system 프롬프트가 프론트에서 안 왔으면 서버에서 생성 (타로/운세 채팅)
      if (!system) {
        const base = isPremium ? PREMIUM_SYSTEM : FREE_SYSTEM;
        serverSystem = userContext ? base + '\n' + userContext : base;
        serverMaxTokens = isPremium ? 1200 : 500;
      }
    } catch (err) {
      // KV 오류 시 무료로 폴백
      console.error('KV error:', err);
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: serverMaxTokens,
        system: serverSystem,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'API error' });
    }

    // 성공 후 사용량 증가
    if (email) {
      try {
        await incrementUsage(email, type || 'chat');
      } catch (err) {
        console.error('Usage increment error:', err);
      }
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/chat.js
git commit -m "feat: add KV-based premium verification, usage limits, and prompt branching to /api/chat"
```

---

### Task 4: `POST /api/payment-confirm` 수정 — KV에 프리미엄 저장

**Files:**
- Modify: `api/payment-confirm.js`

- [ ] **Step 1: payment-confirm.js에 KV 프리미엄 저장 추가**

`api/payment-confirm.js`를 아래 내용으로 교체:

```js
// api/payment-confirm.js
import { setPremium } from './_kv.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Payment not configured' });

  const { paymentKey, orderId, amount, email } = req.body;
  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  if (![99, 1900].includes(Number(amount))) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Payment confirmation failed' });
    }

    // KV에 프리미엄 저장
    const days = Number(amount) === 99 ? 1 : 30;
    const ttl = days === 1 ? 86400 : 2592000;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    const expiryStr = expiry.toISOString().slice(0, 10);

    await setPremium(email, {
      plan: days === 1 ? '1day' : '30day',
      expiry: expiryStr,
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      approvedAt: data.approvedAt,
    }, ttl);

    return res.status(200).json({
      success: true,
      premium: true,
      expiry: expiryStr,
      plan: days === 1 ? '1day' : '30day',
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      approvedAt: data.approvedAt,
      method: data.method,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/payment-confirm.js
git commit -m "feat: save premium status to Vercel KV after payment confirmation"
```

---

### Task 5: 프론트엔드 — 사용자 모달에 이메일 필드 추가 (`index.html`)

**Files:**
- Modify: `index.html:337-353`

- [ ] **Step 1: 사용자 정보 모달에 이메일 입력 필드 추가**

성별 필드 아래, 제출 버튼 위에 이메일 필드를 추가한다:

기존:
```html
      <div class="user-modal-field">
        <label class="user-modal-label">성별</label>
        <div class="user-modal-gender">
          <button class="gender-btn" onclick="selectGender('여',this)">여성</button>
          <button class="gender-btn" onclick="selectGender('남',this)">남성</button>
          <button class="gender-btn" onclick="selectGender('선택안함',this)">선택안함</button>
        </div>
      </div>
      <button class="user-modal-submit" onclick="submitUserInfo()">무료로 운세 보기 ✨</button>
```

변경:
```html
      <div class="user-modal-field">
        <label class="user-modal-label">성별</label>
        <div class="user-modal-gender">
          <button class="gender-btn" onclick="selectGender('여',this)">여성</button>
          <button class="gender-btn" onclick="selectGender('남',this)">남성</button>
          <button class="gender-btn" onclick="selectGender('선택안함',this)">선택안함</button>
        </div>
      </div>
      <div class="user-modal-field">
        <label class="user-modal-label">이메일 (기기 변경 시 프리미엄 복원용)</label>
        <input class="user-modal-input" id="um-email" type="email" placeholder="예: me@example.com">
      </div>
      <button class="user-modal-submit" onclick="submitUserInfo()">무료로 운세 보기 ✨</button>
```

- [ ] **Step 2: 결제 모달 프리미엄 혜택 문구 업데이트**

`index.html:321-324` 기존:
```html
        <div class="lpf-item">✓ 하루 10회 AI 맞춤 상담</div>
        <div class="lpf-item">✓ 타로·손금·궁합·재물운 무제한 분석</div>
        <div class="lpf-item">✓ 빠른 응답 우선 처리</div>
```

변경:
```html
        <div class="lpf-item">✓ 하루 20회 AI 맞춤 상담</div>
        <div class="lpf-item">✓ 손금·관상 하루 5회 분석</div>
        <div class="lpf-item">✓ 상세 풀이 + 시기별 조언</div>
        <div class="lpf-item">✓ 광고 없는 깔끔한 화면</div>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add email field to user modal, update premium benefit copy"
```

---

### Task 6: 프론트엔드 — `js/app.js` 서버 기반 프리미엄/사용량 관리

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 상수 및 상태 변수 변경**

기존 (`js/app.js:32-33`):
```js
const FREE_LIMIT = 20;
const PREMIUM_LIMIT = 20;
```

변경:
```js
const FREE_LIMIT = 3;
const PREMIUM_LIMIT = 20;
const FREE_PALM_LIMIT = 1;
const PREMIUM_PALM_LIMIT = 5;
let serverStatus = null; // /api/user-status 응답 캐시
```

- [ ] **Step 2: saveUserInfo()에 email 추가**

기존 (`js/app.js:109-114`):
```js
function saveUserInfo(name, birthdate, gender) {
  const today = new Date().toISOString().slice(0,10);
  const zodiac = getZodiac(birthdate);
  const age = today.slice(0,4) - birthdate.slice(0,4);
  localStorage.setItem('daara_user', JSON.stringify({ name, birthdate, gender, zodiac, age, date: today }));
}
```

변경:
```js
function saveUserInfo(name, birthdate, gender, email) {
  const today = new Date().toISOString().slice(0,10);
  const zodiac = getZodiac(birthdate);
  const age = today.slice(0,4) - birthdate.slice(0,4);
  localStorage.setItem('daara_user', JSON.stringify({ name, birthdate, gender, email, zodiac, age, date: today }));
}
```

- [ ] **Step 3: submitUserInfo()에서 email 수집 및 서버 상태 조회**

기존 (`js/app.js:158-171`):
```js
function submitUserInfo() {
  const name = document.getElementById('um-name').value.trim();
  const birth = document.getElementById('um-birth').value;
  if (!name) { document.getElementById('um-name').focus(); return; }
  if (!birth) { document.getElementById('um-birth').focus(); return; }
  const gender = selectedGender || '선택안함';
  saveUserInfo(name, birth, gender);
  document.getElementById('user-modal-overlay').style.display = 'none';
  updateUserBadge();
  const u = getUserInfo();
  autoFillZodiac(u.zodiac);
  addMsg('bot', `<b>${u.name}</b>님, 오늘의 운세가 준비됐어요 😊<br>어제와는 다른 흐름이 보여요. 카드를 뽑아 확인해 보세요 ✨<br><span style="font-size:11px;color:var(--text-muted)">지금 가장 많이 받는 상담: ${getPopularMenu()} 🔥</span>`);
  if (pendingAction) { const fn = pendingAction; pendingAction = null; fn(); }
}
```

변경:
```js
function submitUserInfo() {
  const name = document.getElementById('um-name').value.trim();
  const birth = document.getElementById('um-birth').value;
  if (!name) { document.getElementById('um-name').focus(); return; }
  if (!birth) { document.getElementById('um-birth').focus(); return; }
  const gender = selectedGender || '선택안함';
  const email = (document.getElementById('um-email').value || '').trim();
  saveUserInfo(name, birth, gender, email);
  document.getElementById('user-modal-overlay').style.display = 'none';
  if (email) fetchUserStatus(email);
  updateUserBadge();
  const u = getUserInfo();
  autoFillZodiac(u.zodiac);
  addMsg('bot', `<b>${u.name}</b>님, 오늘의 운세가 준비됐어요 😊<br>어제와는 다른 흐름이 보여요. 카드를 뽑아 확인해 보세요 ✨<br><span style="font-size:11px;color:var(--text-muted)">지금 가장 많이 받는 상담: ${getPopularMenu()} 🔥</span>`);
  if (pendingAction) { const fn = pendingAction; pendingAction = null; fn(); }
}
```

- [ ] **Step 4: showUserInfoModal()에서 email 복원**

기존 (`js/app.js:126-134`):
```js
function showUserInfoModal() {
  document.getElementById('user-modal-overlay').style.display = 'flex';
  const u = getUserInfo();
  if (u) {
    document.getElementById('um-name').value = u.name || '';
    document.getElementById('um-birth').value = u.birthdate || '';
    if (u.gender) { selectedGender = u.gender; document.querySelectorAll('.gender-btn').forEach(b => { if (b.textContent.trim() === u.gender || (u.gender==='선택안함'&&b.textContent.trim()==='선택안함')) b.classList.add('active'); }); }
  }
}
```

변경:
```js
function showUserInfoModal() {
  document.getElementById('user-modal-overlay').style.display = 'flex';
  const u = getUserInfo();
  if (u) {
    document.getElementById('um-name').value = u.name || '';
    document.getElementById('um-birth').value = u.birthdate || '';
    document.getElementById('um-email').value = u.email || '';
    if (u.gender) { selectedGender = u.gender; document.querySelectorAll('.gender-btn').forEach(b => { if (b.textContent.trim() === u.gender || (u.gender==='선택안함'&&b.textContent.trim()==='선택안함')) b.classList.add('active'); }); }
  }
}
```

- [ ] **Step 5: fetchUserStatus() 함수 추가**

`isPremium()` 함수 뒤에 추가:

```js
async function fetchUserStatus(email) {
  if (!email) return;
  try {
    const res = await fetch('/api/user-status?email=' + encodeURIComponent(email));
    if (!res.ok) return;
    serverStatus = await res.json();
    // localStorage 캐시 갱신
    if (serverStatus.isPremium) {
      localStorage.setItem('daara_premium', JSON.stringify({ expiry: serverStatus.expiry, plan: serverStatus.plan }));
    } else {
      localStorage.removeItem('daara_premium');
    }
    localStorage.setItem('daara_usage', JSON.stringify({ date: getToday(), count: serverStatus.used }));
    updateUserBadge();
    toggleAds(!serverStatus.isPremium);
  } catch (e) { /* 네트워크 오류 시 localStorage 폴백 */ }
}
```

- [ ] **Step 6: toggleAds() 함수 추가**

```js
function toggleAds(show) {
  const ad = document.querySelector('.ad-slot');
  if (ad) ad.style.display = show ? '' : 'none';
  // 결과 사이 인터스티셜 광고도 숨기기
  document.querySelectorAll('.ad-interstitial').forEach(el => {
    if (!show) el.style.display = 'none';
  });
}
```

- [ ] **Step 7: isPremium() 및 getDailyLimit() 서버 캐시 반영**

기존 (`js/app.js:49-56`):
```js
function isPremium() {
  try {
    const s = JSON.parse(localStorage.getItem('daara_premium') || 'null');
    return s && s.expiry >= getToday();
  } catch { return false; }
}
function getDailyLimit() { return isPremium() ? PREMIUM_LIMIT : FREE_LIMIT; }
function canUseAPI() { return getUsageToday() < getDailyLimit(); }
```

변경:
```js
function isPremium() {
  if (serverStatus) return serverStatus.isPremium;
  try {
    const s = JSON.parse(localStorage.getItem('daara_premium') || 'null');
    return s && s.expiry >= getToday();
  } catch { return false; }
}
function getDailyLimit() { return isPremium() ? PREMIUM_LIMIT : FREE_LIMIT; }
function getPalmLimit() { return isPremium() ? PREMIUM_PALM_LIMIT : FREE_PALM_LIMIT; }
function canUseAPI() {
  if (serverStatus) return serverStatus.used < serverStatus.limit;
  return getUsageToday() < getDailyLimit();
}
function canUsePalm() {
  if (serverStatus) return serverStatus.palmUsed < serverStatus.palmLimit;
  return true; // localStorage 폴백은 제한 없음 (서버에서 최종 판단)
}
```

- [ ] **Step 8: askClaude()에서 system 프롬프트를 서버로 이동 + email 전송 + 403 처리**

기존 (`js/app.js:263-301` — askClaude 함수 전체)를 아래로 교체:

```js
async function askClaude(overrideMsg, isAuto, userLabel, cacheKey = null) {
  if (!canUseAPI()) {
    document.getElementById('limit-modal-overlay').style.display = 'flex';
    return;
  }
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) {
      if (userLabel) addMsg('user', userLabel);
      addMsg('bot', cached);
      return;
    }
  }
  const btn = document.getElementById('send-btn'), input = document.getElementById('chat-input');
  btn.disabled = true; input.disabled = true;
  if (userLabel) addMsg('user', userLabel);
  const typingEl = addMsg('bot', '생각하고 있어요···'); typingEl.classList.add('typing');

  const u = getUserInfo();
  const email = u?.email || null;
  const userContext = u ? `\n[사용자] 이름: ${u.name} / 생년월일: ${u.birthdate}(${u.age}세) / 성별: ${u.gender} / 별자리: ${u.zodiac} / 오늘: ${new Date().toLocaleDateString('ko-KR')}` : '';

  const messages = overrideMsg ? [{ role: 'user', content: overrideMsg }] : [...history];
  try {
    const data = await callAPI({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages,
      email,
      userContext,
      type: 'chat',
    });
    const reply = data?.content?.[0]?.text || '잠깐 다시 시도해 주실 수 있어요? 😊';
    typingEl.classList.remove('typing'); typingEl.innerHTML = formatReply(reply);
    if (!isAuto) { history.push({ role: 'assistant', content: reply }); if (history.length > 12) history = history.slice(-12); }
    incrementUsage();
    if (serverStatus) serverStatus.used += 1;
    if (cacheKey) setCached(cacheKey, formatReply(reply));
    updateUserBadge();
  } catch (e) {
    typingEl.classList.remove('typing');
    if (e.message === 'limit_exceeded') {
      typingEl.innerHTML = '';
      document.getElementById('limit-modal-overlay').style.display = 'flex';
    } else {
      typingEl.innerHTML = '잠깐 연결이 끊겼어요. 조금 있다 다시 시도해 주세요 😊';
    }
  }
  btn.disabled = false; input.disabled = false; input.focus();
  document.getElementById('messages').scrollTop = 99999;
}
```

- [ ] **Step 9: callAPI()에서 403 에러를 구분하여 throw**

기존 (`js/app.js:258-262`):
```js
async function callAPI(body) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || 'API Error: ' + res.status); }
  return res.json();
}
```

변경:
```js
async function callAPI(body) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const e = await res.json();
    if (res.status === 403 && e.error === 'limit_exceeded') throw new Error('limit_exceeded');
    throw new Error(e?.error?.message || 'API Error: ' + res.status);
  }
  return res.json();
}
```

- [ ] **Step 10: DOMContentLoaded에서 서버 상태 조회 추가**

`js/app.js:313` DOMContentLoaded 핸들러 안, `const u = getUserInfo();` 다음 줄에 추가:

```js
  if (u?.email) fetchUserStatus(u.email);
```

- [ ] **Step 11: Commit**

```bash
git add js/app.js
git commit -m "feat: server-based premium/usage management in frontend with KV fallback"
```

---

### Task 7: 프론트엔드 — `js/payment.js` 이메일 전송 + 프리미엄 캐시

**Files:**
- Modify: `js/payment.js`

- [ ] **Step 1: handlePaymentSuccess()에서 email 전송 + 서버 응답 캐시**

기존 (`js/payment.js:43-70`):
```js
async function handlePaymentSuccess(paymentKey, orderId, amount) {
  try {
    const res = await fetch('/api/payment-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });
    const data = await res.json();
    if (data.success) {
      const days = Number(amount) === 99 ? 1 : 30;
      const expiry = new Date(); expiry.setDate(expiry.getDate() + days);
      localStorage.setItem('daara_premium', JSON.stringify({
        expiry: expiry.toISOString().slice(0,10),
        paymentKey,
        approvedAt: data.approvedAt,
      }));
      updateUserBadge();
      const msg = days === 1
        ? '프리미엄이 활성화됐어요 ✨ 오늘 하루 10회 AI 상담을 마음껏 이용해 보세요 😊'
        : '프리미엄으로 업그레이드됐어요 ✨ 오늘부터 30일간 하루 10회 상담이 가능해요 😊';
      addMsg('bot', msg);
    } else {
      addMsg('bot', `결제 확인 중 문제가 생겼어요: ${data.error || '잠깐 후 다시 시도해 주세요 😊'}`);
    }
  } catch (e) {
    addMsg('bot', '결제 확인 중 오류가 생겼어요. 고객센터에 문의해 주세요 😊');
  }
}
```

변경:
```js
async function handlePaymentSuccess(paymentKey, orderId, amount) {
  const u = getUserInfo();
  const email = u?.email || '';
  try {
    const res = await fetch('/api/payment-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), email }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('daara_premium', JSON.stringify({
        expiry: data.expiry,
        plan: data.plan,
        paymentKey,
        approvedAt: data.approvedAt,
      }));
      if (email) fetchUserStatus(email);
      updateUserBadge();
      toggleAds(false);
      const msg = data.plan === '1day'
        ? '프리미엄이 활성화됐어요 ✨ 오늘 하루 20회 AI 상담을 마음껏 이용해 보세요 😊'
        : '프리미엄으로 업그레이드됐어요 ✨ 30일간 하루 20회 상담이 가능해요 😊';
      addMsg('bot', msg);
    } else {
      addMsg('bot', `결제 확인 중 문제가 생겼어요: ${data.error || '잠깐 후 다시 시도해 주세요 😊'}`);
    }
  } catch (e) {
    addMsg('bot', '결제 확인 중 오류가 생겼어요. 고객센터에 문의해 주세요 😊');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/payment.js
git commit -m "feat: send email with payment confirmation, cache server premium response"
```

---

### Task 8: 프론트엔드 — `js/fortune.js` 손금/관상에 email + type 전달

**Files:**
- Modify: `js/fortune.js`

- [ ] **Step 1: analyzePalm()에서 canUsePalm() 체크 + email/type 전달**

기존 (`js/fortune.js:83`):
```js
  if (!canUseAPI()) { document.getElementById('limit-modal-overlay').style.display = 'flex'; return; }
```

변경:
```js
  if (!canUsePalm()) { document.getElementById('limit-modal-overlay').style.display = 'flex'; return; }
```

기존 (`js/fortune.js:111`):
```js
    const res = await callAPI({ model: 'claude-sonnet-4-6', max_tokens: 700, system, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: palmImageData } }, { type: 'text', text: userText }] }] });
```

변경:
```js
    const u = getUserInfo();
    const res = await callAPI({ model: 'claude-sonnet-4-6', max_tokens: 700, system, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: palmImageData } }, { type: 'text', text: userText }] }], email: u?.email || '', type: 'palm' });
```

기존 (`js/fortune.js:115`):
```js
    incrementUsage(); updateUserBadge();
```

변경:
```js
    incrementUsage();
    if (serverStatus) serverStatus.palmUsed += 1;
    updateUserBadge();
```

- [ ] **Step 2: Commit**

```bash
git add js/fortune.js
git commit -m "feat: add palm usage limit check and email/type to palm analysis API call"
```

---

### Task 9: Vercel KV 설정 및 배포 테스트

**Files:**
- 없음 (환경 설정)

- [ ] **Step 1: .gitignore에 node_modules 추가 확인**

```bash
grep -q 'node_modules' .gitignore || echo 'node_modules' >> .gitignore
```

- [ ] **Step 2: Vercel KV 생성 안내**

Vercel Dashboard에서:
1. Storage → Create → KV 선택
2. 이름: `daara-kv`
3. 프로젝트에 연결 (Connect to Project)
4. 환경변수 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 자동 생성 확인

- [ ] **Step 3: 로컬 환경변수 설정 (개발용)**

```bash
vercel env pull .env.local
```

- [ ] **Step 4: 프리뷰 배포 및 테스트**

```bash
vercel
```

테스트 항목:
1. 사용자 정보 모달에 이메일 필드 표시 확인
2. 이메일 입력 후 저장 → 새로고침 시 복원 확인
3. 무료 3회 상담 후 결제 모달 표시 확인
4. 99원 테스트 결제 → 프리미엄 활성화 확인
5. 프리미엄 상태에서 20회 한도 확인
6. 프리미엄 상태에서 광고 숨김 확인
7. 손금/관상 분석 무료 1회 → 프리미엄 5회 확인

- [ ] **Step 5: Commit (.gitignore 변경 시)**

```bash
git add .gitignore
git commit -m "chore: add node_modules to gitignore"
```

- [ ] **Step 6: 프로덕션 배포**

```bash
vercel --prod
```
