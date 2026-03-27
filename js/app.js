/* ── 사용량 제한 & 캐싱 ── */
const FREE_LIMIT = 3;
const PREMIUM_LIMIT = 10;

function getToday() { return new Date().toISOString().slice(0,10); }

function getUsageToday() {
  try {
    const s = JSON.parse(localStorage.getItem('daara_usage') || 'null');
    if (!s || s.date !== getToday()) return 0;
    return s.count || 0;
  } catch { return 0; }
}
function incrementUsage() {
  const count = getUsageToday() + 1;
  localStorage.setItem('daara_usage', JSON.stringify({ date: getToday(), count }));
  updateUsageIndicator();
}
function isPremium() {
  try {
    const s = JSON.parse(localStorage.getItem('daara_premium') || 'null');
    return s && s.expiry >= getToday();
  } catch { return false; }
}
function getDailyLimit() { return isPremium() ? PREMIUM_LIMIT : FREE_LIMIT; }
function canUseAPI() { return getUsageToday() < getDailyLimit(); }

function updateUsageIndicator() {
  const badge = document.getElementById('user-info-badge');
  if (!badge) return;
  const used = getUsageToday();
  const limit = getDailyLimit();
  const dots = Array.from({length: limit > 5 ? 5 : limit}, (_, i) =>
    `<div class="usage-dot${i < used ? ' used' : ''}"></div>`
  ).join('');
  const indEl = badge.querySelector('.usage-indicator');
  if (indEl) indEl.innerHTML = dots;
}

/* 응답 캐싱 */
function getCached(key) {
  try {
    const s = JSON.parse(localStorage.getItem('daara_rc_' + key) || 'null');
    if (!s || s.date !== getToday()) return null;
    return s.val;
  } catch { return null; }
}
function setCached(key, val) {
  try { localStorage.setItem('daara_rc_' + key, JSON.stringify({ date: getToday(), val })); } catch {}
}

/* ── 사용자 정보 (당일 캐시) ── */
let selectedGender = null;

function getZodiac(birthdate) {
  const d = new Date(birthdate); const m = d.getMonth() + 1; const day = d.getDate();
  if ((m===3&&day>=21)||(m===4&&day<=19)) return '양자리';
  if ((m===4&&day>=20)||(m===5&&day<=20)) return '황소자리';
  if ((m===5&&day>=21)||(m===6&&day<=20)) return '쌍둥이자리';
  if ((m===6&&day>=21)||(m===7&&day<=22)) return '게자리';
  if ((m===7&&day>=23)||(m===8&&day<=22)) return '사자자리';
  if ((m===8&&day>=23)||(m===9&&day<=22)) return '처녀자리';
  if ((m===9&&day>=23)||(m===10&&day<=22)) return '천칭자리';
  if ((m===10&&day>=23)||(m===11&&day<=21)) return '전갈자리';
  if ((m===11&&day>=22)||(m===12&&day<=21)) return '사수자리';
  if ((m===12&&day>=22)||(m===1&&day<=19)) return '염소자리';
  if ((m===1&&day>=20)||(m===2&&day<=18)) return '물병자리';
  return '물고기자리';
}
function getUserInfo() {
  try {
    const stored = JSON.parse(localStorage.getItem('daara_user') || 'null');
    if (!stored) return null;
    const today = new Date().toISOString().slice(0,10);
    if (stored.date !== today) { localStorage.removeItem('daara_user'); return null; }
    return stored;
  } catch { return null; }
}
function saveUserInfo(name, birthdate, gender) {
  const today = new Date().toISOString().slice(0,10);
  const zodiac = getZodiac(birthdate);
  const age = today.slice(0,4) - birthdate.slice(0,4);
  localStorage.setItem('daara_user', JSON.stringify({ name, birthdate, gender, zodiac, age, date: today }));
}
function getUserContext() {
  const u = getUserInfo(); if (!u) return '';
  return `\n[사용자] 이름: ${u.name} / 생년월일: ${u.birthdate}(${u.age}세) / 성별: ${u.gender} / 별자리: ${u.zodiac} / 오늘: ${new Date().toLocaleDateString('ko-KR')}`;
}
function selectGender(val, el) {
  selectedGender = val;
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

let pendingAction = null; // 유저 정보 입력 후 실행할 콜백
function showUserInfoModal() {
  document.getElementById('user-modal-overlay').style.display = 'flex';
  const u = getUserInfo();
  if (u) {
    document.getElementById('um-name').value = u.name || '';
    document.getElementById('um-birth').value = u.birthdate || '';
    if (u.gender) { selectedGender = u.gender; document.querySelectorAll('.gender-btn').forEach(b => { if (b.textContent.trim() === u.gender || (u.gender==='선택안함'&&b.textContent.trim()==='선택안함')) b.classList.add('active'); }); }
  }
}
function ensureUserInfo(callback) {
  const u = getUserInfo();
  if (u) return true;
  pendingAction = callback || null;
  showUserInfoModal();
  return false;
}
function autoFillZodiac(zodiac) {
  if (!zodiac) return;
  const groups = { a: 'zg-a', today: 'zg-today', mo: 'zg-mo', m1: 'zg-m1' };
  for (const [group, gridId] of Object.entries(groups)) {
    const grid = document.getElementById(gridId);
    if (!grid) continue;
    const btns = grid.querySelectorAll('.zodiac-btn');
    btns.forEach(b => {
      b.classList.remove('sel-a', 'sel-m1', 'sel-m2', 'sel-mo', 'sel-today');
      if (b.textContent.includes(zodiac.replace('자리',''))) {
        b.classList.add(group === 'today' ? 'sel-a' : 'sel-' + group);
        sel[group] = zodiac;
      }
    });
  }
}
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
  addMsg('bot', `<b>${u.name}</b>님, 다시 오셨군요 😊<br>${u.zodiac} ${u.name}님만을 위한 AI 맞춤 운세가 준비되어 있어요.<br><br>카드를 뽑거나 메뉴에서 <b class="hl-gold">별자리·궁합·재물운·손금</b> 분석을 받아보세요 ✨`);
  if (pendingAction) { const fn = pendingAction; pendingAction = null; fn(); }
}
function updateUserBadge() {
  const u = getUserInfo(); const badge = document.getElementById('user-info-badge');
  if (!u) { badge.style.display = 'none'; return; }
  badge.style.display = 'flex';
  const limit = getDailyLimit();
  const used = getUsageToday();
  const dots = Array.from({length: Math.min(limit, 5)}, (_, i) =>
    `<div class="usage-dot${i < used ? ' used' : ''}"></div>`
  ).join('');
  const premBadge = isPremium() ? `<span style="font-size:10px;color:var(--gold);margin-right:2px">★PRO</span>` : '';
  badge.innerHTML = `${premBadge}<span class="user-badge-name">${u.name}</span><span class="user-badge-dot">·</span><span>${u.zodiac}</span><div class="usage-indicator">${dots}</div><span style="margin-left:6px;font-size:11px;color:var(--text-muted)">${used}/${limit}</span><span style="margin-left:auto;font-size:11px;color:var(--indigo-light)">수정 ✎</span>`;
}

/* ── 상태 변수 ── */
let drawnCards = null, history = [], moneyCard = null, palmImageData = null, palmPreviewSrc = null;
let flippedCards = [false, false, false];
const sel = { a: null, m1: null, m2: null, mo: null, today: null };

/* ── UI 공통 ── */
function goMenu(menu, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + menu).classList.add('active');
  document.querySelectorAll('.main-title-text').forEach(t => t.textContent = TITLES[menu]);
}
function addMsg(role, content, type = 'text', cardIndex = null) {
  const box = document.getElementById('messages');
  const wrap = document.createElement('div'); wrap.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  if (cardIndex !== null) wrap.setAttribute('data-card-index', cardIndex);
  const av = document.createElement('div'); av.className = 'msg-avatar ' + (role === 'user' ? 'user' : 'bot'); av.textContent = role === 'user' ? '나' : 'D';
  const bubble = document.createElement('div');
  if (type === 'card-reveal') { bubble.className = 'card-reveal-msg'; bubble.innerHTML = content; }
  else if (type === 'ad') { bubble.className = 'ad-interstitial'; bubble.innerHTML = content; }
  else if (type === 'palm-result') { bubble.className = 'palm-result-msg'; bubble.innerHTML = content; }
  else { bubble.className = 'msg-bubble'; bubble.innerHTML = content; }
  role === 'user' ? (wrap.appendChild(bubble), wrap.appendChild(av)) : (wrap.appendChild(av), wrap.appendChild(bubble));
  box.appendChild(wrap); box.scrollTop = box.scrollHeight;
  return bubble;
}
function scrollToCardMsg(i) {
  if (!drawnCards || !flippedCards[i]) return;
  const msg = document.querySelector(`[data-card-index="${i}"]`);
  if (msg) {
    goMenu('tarot', document.querySelector('.n-tarot'));
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    msg.style.transition = 'background 0.3s';
    msg.style.background = 'rgba(99,102,241,0.1)';
    setTimeout(() => msg.style.background = '', 1200);
  }
}
function selectZ(group, el, name) {
  const ids = { a: 'zg-a', m1: 'zg-m1', m2: 'zg-m2', mo: 'zg-mo', today: 'zg-today' };
  document.querySelectorAll('#' + ids[group] + ' .zodiac-btn').forEach(b => b.classList.remove('sel-a', 'sel-m1', 'sel-m2', 'sel-mo', 'sel-today'));
  el.classList.add(group === 'today' ? 'sel-a' : 'sel-' + group); sel[group] = name;
}

/* ── API ── */
async function callAPI(body) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || 'API Error: ' + res.status); }
  return res.json();
}
async function askClaude(overrideMsg, isAuto, userLabel, cacheKey = null) {
  if (!canUseAPI()) {
    document.getElementById('limit-modal-overlay').style.display = 'flex';
    return;
  }
  // 캐시 히트
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
  const system = `당신은 따뜻하고 섬세한 AI 타로·운세 상담사 '다아라'입니다.${getUserContext()}
사용자 감정에 먼저 공감해 주세요. 친한 언니처럼 따뜻하고 공감 어린 존댓말을 씁니다.
사용자의 이름, 별자리, 나이, 성별을 자연스럽게 반영해 개인화된 답변을 해주세요.
"~것 같아요", "~할 수 있어요" 처럼 단정 짓지 않고 부드럽게 표현합니다.
이모지를 1~2개 자연스럽게 씁니다. 3~6문장 내외로 간결하고 따뜻하게 마무리합니다.
답변은 항상 같은 사용자에 대한 일관된 흐름을 유지해 주세요.`;
  const messages = overrideMsg ? [{ role: 'user', content: overrideMsg }] : [...history];
  try {
    const data = await callAPI({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system, messages });
    const reply = data?.content?.[0]?.text || '잠깐 다시 시도해 주실 수 있어요? 😊';
    typingEl.classList.remove('typing'); typingEl.innerHTML = reply.replace(/\n/g, '<br>');
    if (!isAuto) { history.push({ role: 'assistant', content: reply }); if (history.length > 12) history = history.slice(-12); }
    incrementUsage();
    if (cacheKey) setCached(cacheKey, reply.replace(/\n/g, '<br>'));
    updateUserBadge();
  } catch (e) {
    typingEl.classList.remove('typing');
    typingEl.innerHTML = '잠깐 연결이 끊겼어요. 조금 있다 다시 시도해 주세요 😊';
  }
  btn.disabled = false; input.disabled = false; input.focus();
  document.getElementById('messages').scrollTop = 99999;
}
async function sendMessage() {
  if (!ensureUserInfo(() => sendMessage())) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim(); if (!text) return;
  addMsg('user', text); input.value = '';
  history.push({ role: 'user', content: text });
  await askClaude(null, false, null);
}

/* ── 초기화 ── */
document.addEventListener('DOMContentLoaded', async () => {
  // 토스 결제 리다이렉트 처리
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    window.history.replaceState({}, '', window.location.pathname);
    const u = getUserInfo();
    if (!u) { showUserInfoModal(); }
    else { updateUserBadge(); addMsg('bot', `안녕하세요, <b>${u.name}</b>님 😊 결제 확인 중이에요···`); }
    await handlePaymentSuccess(params.get('paymentKey'), params.get('orderId'), params.get('amount'));
    return;
  }
  if (params.get('payment') === 'fail') {
    window.history.replaceState({}, '', window.location.pathname);
    handlePaymentFail(params.get('code'), params.get('message'));
  }

  const u = getUserInfo();
  if (u) {
    updateUserBadge();
    autoFillZodiac(u.zodiac);
    addMsg('bot', `<b>${u.name}</b>님, 다시 오셨군요 😊<br>${u.zodiac} ${u.name}님만을 위한 AI 맞춤 운세가 준비되어 있어요.<br><br>카드를 뽑거나 메뉴에서 <b class="hl-gold">별자리·궁합·재물운·손금</b> 분석을 받아보세요 ✨`);
  } else {
    addMsg('bot', `반갑습니다 😊 <b>다아라</b>에 오신 걸 환영해요!<br>AI가 타로·별자리·궁합·재물운·손금을 실시간으로 분석해 드려요.<br><br>카드를 뽑거나 메뉴를 선택하면 <b class="hl-gold">무료로 바로 시작</b>할 수 있어요 ✨`);
  }
});
