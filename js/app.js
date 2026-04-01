/* ── 온보딩 스플래시 ── */
let obSlideIdx = 0;
function nextOnboardingSlide() {
  const slides = document.querySelectorAll('.onboarding-slide');
  const dots = document.querySelectorAll('.ob-dot');
  const btn = document.getElementById('onboarding-btn');
  obSlideIdx++;
  if (obSlideIdx >= slides.length) { closeOnboarding(); return; }
  slides.forEach((s, i) => s.classList.toggle('active', i === obSlideIdx));
  dots.forEach((d, i) => d.classList.toggle('active', i === obSlideIdx));
  if (obSlideIdx === slides.length - 1) btn.textContent = '시작하기';
}
function closeOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 400);
  localStorage.setItem('daara_onboarded', '1');
}
function showOnboarding() {
  if (localStorage.getItem('daara_onboarded')) {
    document.getElementById('onboarding-overlay')?.remove();
    return;
  }
}

/* ── 답변 스타일링 ── */
function formatReply(text) {
  // 마크다운 헤딩 제거 (## / ### / #)
  text = text.replace(/^#{1,3}\s*/gm, '');
  // 구분선(---, ***, ___, ──, ——) 제거
  text = text.replace(/^[-*_─—]{2,}\s*$/gm, '');
  // 이모지 헤딩 패턴
  const headingRe = /^(🔮|🌙|⚠️|✨|⭐|💰|♡|◈|🌅|💕|🏠|💼|🩺|🍀|🔢|🎨|💵|💲|🫰|🤑|💸|🧡|❤️|💛|💚|💙|💜|🩷|🔥|📊|🏥|🧘|♈|♉|♊|♋|♌|♍|♎|♏|♐|♑|♒|♓)(.+)/;
  const lines = text.split('\n');
  let html = '';
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (!inSection) html += '<br>';
      continue;
    }
    const m = line.match(headingRe);
    if (m) {
      if (inSection) html += '</div>'; // 이전 섹션 닫기
      html += `<div class="reply-section"><div class="reply-heading">${m[1]}${m[2].replace(/\*\*(.+?)\*\*/g, '<span class="hl-accent">$1</span>')}</div><div class="reply-body">`;
      inSection = true;
    } else {
      const styled = line.replace(/\*\*(.+?)\*\*/g, '<span class="hl-accent">$1</span>');
      if (inSection) {
        html += `<p>${styled}</p>`;
      } else {
        html += `<p>${styled}</p>`;
      }
    }
  }
  if (inSection) html += '</div></div>';
  return html;
}

/* ── 소셜 프루프 ── */
function getSocialCount(type) {
  const hour = new Date().getHours();
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  const seed = dayOfYear * 100 + hour;
  const pseudo = ((seed * 9301 + 49297) % 233280) / 233280;
  const ranges = {
    consulting: [80, 280],
    premium: [50, 150],
  };
  const [min, max] = ranges[type] || [50, 200];
  const timeWeight = hour < 8 ? 0.4 : hour < 12 ? 0.7 : hour < 18 ? 0.85 : 1.0;
  return Math.floor(min + (max - min) * pseudo * timeWeight);
}

function getPopularMenu() {
  const day = new Date().getDay();
  if (day === 0) return '별자리 운세';
  if (day >= 5) return '연애 궁합';
  return '오늘의 운세';
}

/* ── 위치 정보 (카카오 로컬 API, IP 폴백) ── */
let userLocation = null;
(function fetchLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const res = await fetch(`/api/location?lat=${lat}&lon=${lon}`);
        if (res.ok) {
          const d = await res.json();
          if (d.city) {
            userLocation = { city: d.city, region: d.region, country: d.country };
          } else { fallbackIP(); }
        } else { fallbackIP(); }
      } catch { fallbackIP(); }
    }, () => fallbackIP(), { timeout: 5000 });
  } else { fallbackIP(); }
  async function fallbackIP() {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) { const d = await res.json(); userLocation = { city: d.city, region: d.region, country: d.country_name }; }
    } catch {}
  }
})();

/* ── 사용량 제한 & 캐싱 ── */
const FREE_LIMIT = 5;
const PREMIUM_LIMIT = 50;

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
function saveUserInfo(name, birthdate, gender, siji, job, calendar) {
  const today = new Date().toISOString().slice(0,10);
  const zodiac = getZodiac(birthdate);
  const age = today.slice(0,4) - birthdate.slice(0,4);
  // 천간지지 계산 (사주 연주·일주)
  const saju = getSaju(birthdate);
  localStorage.setItem('daara_user', JSON.stringify({ name, birthdate, gender, zodiac, age, siji: siji || '', job: job || '', saju, calendar: calendar || '양력', date: today }));
}
function getSaju(birthdate) {
  const heavenly = ['갑','을','병','정','무','기','경','신','임','계'];
  const earthly = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
  const y = parseInt(birthdate.slice(0,4));
  // 연주 (년간지)
  const yH = heavenly[(y - 4) % 10];
  const yE = earthly[(y - 4) % 12];
  // 일주 (일간지) — 기준일 2000-01-07(경진일)로부터 계산
  const base = new Date(2000, 0, 7);
  const target = new Date(birthdate);
  const diff = Math.round((target - base) / 86400000);
  const dH = heavenly[((diff % 10) + 10) % 10]; // 경=6이므로 offset 6
  const dE = earthly[((diff % 12) + 12) % 12]; // 진=4이므로 offset 4
  // 보정: 2000-01-07 = 경(6)진(4)
  const dHi = (6 + diff % 10 + 10) % 10;
  const dEi = (4 + diff % 12 + 12) % 12;
  return { year: yH + yE, day: heavenly[dHi] + earthly[dEi] };
}
function getUserContext() {
  const u = getUserInfo();
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const locStr = userLocation ? ` / 위치: ${userLocation.city}, ${userLocation.region}, ${userLocation.country}` : '';
  // 현재 시진 계산
  const hour = now.getHours();
  const currentSiji = ['자시','축시','인시','묘시','진시','사시','오시','미시','신시','유시','술시','해시'][Math.floor(((hour + 1) % 24) / 2)];
  if (!u) return `\n[현재] ${dateStr} ${timeStr} (${currentSiji})${locStr}`;
  let ctx = `\n[사용자] 이름: ${u.name} / 생년월일: ${u.birthdate}(${u.calendar || '양력'}, ${u.age}세) / 성별: ${u.gender} / 별자리: ${u.zodiac}`;
  if (u.saju) ctx += ` / 사주 연주: ${u.saju.year} / 일주: ${u.saju.day}`;
  if (u.siji) ctx += ` / 태어난 시: ${u.siji}`;
  if (u.job) ctx += ` / 직업: ${u.job}`;
  ctx += `\n[현재] ${dateStr} ${timeStr} (${currentSiji})${locStr}`;
  return ctx;
}
function selectGender(val, el) {
  selectedGender = val;
  document.querySelectorAll('.user-modal-gender .gender-btn:not(.cal-btn)').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}
let selectedCalendar = '양력';
function selectCalendar(val, el) {
  selectedCalendar = val;
  document.querySelectorAll('.cal-btn:not(.match-p-cal)').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

let pendingAction = null; // 유저 정보 입력 후 실행할 콜백
function showUserInfoModal() {
  document.getElementById('user-modal-overlay').style.display = 'flex';
  const u = getUserInfo();
  if (u) {
    document.getElementById('um-name').value = u.name || '';
    setBirthSelects('um-birth-y', 'um-birth-m', 'um-birth-d', u.birthdate);
    document.getElementById('um-siji').value = u.siji || '';
    document.getElementById('um-job').value = u.job || '';
    if (u.gender) { selectedGender = u.gender; document.querySelectorAll('.user-modal-gender .gender-btn:not(.cal-btn)').forEach(b => { if (b.textContent.trim() === u.gender || (u.gender==='선택안함'&&b.textContent.trim()==='선택안함')) b.classList.add('active'); }); }
    selectedCalendar = u.calendar || '양력';
  } else {
    selectedCalendar = '양력';
  }
  document.querySelectorAll('.cal-btn:not(.match-p-cal)').forEach(b => { b.classList.remove('active'); if (b.textContent.includes(selectedCalendar === '음력' ? '음력' : '양력')) b.classList.add('active'); });
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
  const birth = getBirthFromSelects('um-birth-y', 'um-birth-m', 'um-birth-d');
  if (!name) { document.getElementById('um-name').focus(); return; }
  if (!birth) { document.getElementById('um-birth-y').focus(); return; }
  const gender = selectedGender || '선택안함';
  const siji = document.getElementById('um-siji').value;
  const job = document.getElementById('um-job').value.trim();
  const calendar = selectedCalendar || '양력';
  saveUserInfo(name, birth, gender, siji, job, calendar);
  document.getElementById('user-modal-overlay').style.display = 'none';
  updateUserBadge();
  if (typeof updateMatchMyInfo === 'function') updateMatchMyInfo();
  if (typeof updateMoneyMyInfo === 'function') updateMoneyMyInfo();
  const u = getUserInfo();
  autoFillZodiac(u.zodiac);
  addMsg('bot', `<b>${u.name}</b>님, 오늘의 운세가 준비됐어요 😊<br>어제와는 다른 흐름이 보여요. 카드를 뽑아 확인해 보세요 ✨<br><span style="font-size:11px;color:var(--text-muted)">지금 가장 많이 받는 상담: ${getPopularMenu()} 🔥</span>`);
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
let currentMsgBoxId = 'messages'; // 현재 활성 메시지 영역

/* ── UI 공통 ── */
const panelScrollPos = {};
function goMenu(menu, el) {
  // 현재 패널 스크롤 위치 저장
  const activePanel = document.querySelector('.panel.active');
  if (activePanel) panelScrollPos[activePanel.id] = activePanel.scrollTop;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + menu);
  panel.classList.add('active');
  document.querySelectorAll('.main-title-text').forEach(t => t.textContent = TITLES[menu]);
  currentMsgBoxId = menu === 'tarot' ? 'messages' : 'messages-' + menu;
  if (menu === 'match' && typeof updateMatchMyInfo === 'function') updateMatchMyInfo();
  if (menu === 'money' && typeof updateMoneyMyInfo === 'function') updateMoneyMyInfo();
  toggleSidebar(true); // 메뉴 전환 후 접힌 상태 (선택한 메뉴 하이라이트 유지)
  // 이전 스크롤 위치 복원
  if (panelScrollPos[panel.id] !== undefined) {
    setTimeout(() => panel.scrollTop = panelScrollPos[panel.id], 0);
  }
}
// 메시지 출력 대상을 해당 패널의 messages 영역으로 설정
function showChatPanel(sourceMenu) {
  const targetId = sourceMenu === 'tarot' ? 'messages' : 'messages-' + sourceMenu;
  currentMsgBoxId = targetId;
  document.querySelectorAll('.main-title-text').forEach(t => t.textContent = TITLES[sourceMenu] || TITLES.tarot);
}

/* ── 사이드바 접기/펼치기 (모바일) ── */
function toggleSidebar(collapse) {
  const sb = document.querySelector('.sidebar');
  if (!sb || window.innerWidth > 768) return;
  if (collapse === undefined) collapse = !sb.classList.contains('collapsed');
  sb.classList.toggle('collapsed', collapse);
}
document.addEventListener('click', function(e) {
  if (window.innerWidth > 768) return;
  const sb = document.querySelector('.sidebar');
  if (!sb) return;
  // 접힌 상태에서 메뉴 영역 클릭 → 펼치기 (카드 클릭은 제외)
  if (sb.classList.contains('collapsed') && e.target.closest('.sidebar') && !e.target.closest('.mini-card')) {
    e.preventDefault();
    e.stopPropagation();
    toggleSidebar(false);
  }
});
document.addEventListener('DOMContentLoaded', function() {
  // 스크롤 내리면 접기 (올려도 자동 펼침 없음 — 메뉴 클릭으로만 펼침)
  function onScrollDown() { toggleSidebar(true); }
  const msgs = document.getElementById('messages');
  if (msgs) msgs.addEventListener('scroll', function() { if (this.scrollTop > 30) onScrollDown(); });
  document.querySelectorAll('.panel').forEach(p => {
    p.addEventListener('scroll', function() { if (this.scrollTop > 30) onScrollDown(); });
  });
  // 모바일 터치 스크롤 감지
  let touchStartY = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (window.innerWidth > 768) return;
    const deltaY = touchStartY - e.touches[0].clientY;
    if (deltaY > 15) toggleSidebar(true); // 스크롤 내림 → 접기만
  }, { passive: true });
});
function togglePanelMessages(btn) {
  const box = btn.parentElement;
  const isCollapsed = box.classList.toggle('collapsed');
  btn.querySelector('.pm-toggle-arrow').textContent = isCollapsed ? '▼' : '▲';
  btn.querySelector('.pm-toggle-label').textContent = isCollapsed ? '결과 보기' : '결과 접기';
}
function addMsg(role, content, type = 'text', cardIndex = null) {
  const box = document.getElementById(currentMsgBoxId);
  // panel-messages에 토글 헤더 자동 생성
  if (box.classList.contains('panel-messages') && !box.querySelector('.pm-toggle-btn')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'pm-toggle-btn';
    toggleBtn.innerHTML = '<span class="pm-toggle-arrow">▲</span> <span class="pm-toggle-label">결과 접기</span>';
    toggleBtn.onclick = function() { togglePanelMessages(this); };
    box.insertBefore(toggleBtn, box.firstChild);
    box.classList.remove('collapsed');
  }
  const wrap = document.createElement('div'); wrap.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  if (cardIndex !== null) wrap.setAttribute('data-card-index', cardIndex);
  const av = document.createElement('div'); av.className = 'msg-avatar ' + (role === 'user' ? 'user' : 'bot'); av.textContent = role === 'user' ? '나' : '✦';
  const msgContent = document.createElement('div'); msgContent.className = 'msg-content';
  const label = document.createElement('span'); label.className = 'msg-label';
  label.textContent = role === 'user' ? '나의 질문' : '다아라';
  const bubble = document.createElement('div');
  if (type === 'card-reveal') { bubble.className = 'card-reveal-msg'; bubble.innerHTML = content; }
  else if (type === 'ad') { bubble.className = 'ad-interstitial'; bubble.innerHTML = content; }
  else if (type === 'palm-result') { bubble.className = 'palm-result-msg'; bubble.innerHTML = content; }
  else { bubble.className = 'msg-bubble'; bubble.innerHTML = content; }
  msgContent.appendChild(label); msgContent.appendChild(bubble);
  role === 'user' ? (wrap.appendChild(msgContent), wrap.appendChild(av)) : (wrap.appendChild(av), wrap.appendChild(msgContent));
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
  // 본인 별자리 그룹에서 저장된 정보와 다르면 확인 팝업
  const myGroups = ['a', 'today', 'mo', 'm1'];
  const u = getUserInfo();
  if (u && u.zodiac && myGroups.includes(group) && name !== u.zodiac) {
    showZodiacMismatchModal(u.zodiac, name, function() {
      // 그대로 진행
      applyZodiacSelection(group, el, name, ids);
    });
    return;
  }
  applyZodiacSelection(group, el, name, ids);
}
function applyZodiacSelection(group, el, name, ids) {
  document.querySelectorAll('#' + ids[group] + ' .zodiac-btn').forEach(b => b.classList.remove('sel-a', 'sel-m1', 'sel-m2', 'sel-mo', 'sel-today'));
  el.classList.add(group === 'today' ? 'sel-a' : 'sel-' + group); sel[group] = name;
}
function showZodiacMismatchModal(savedZodiac, selectedZodiac, onContinue) {
  // 기존 모달이 있으면 제거
  let overlay = document.getElementById('zodiac-mismatch-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'zodiac-mismatch-overlay';
  overlay.className = 'zodiac-mismatch-overlay';
  overlay.innerHTML = `
    <div class="zodiac-mismatch-modal">
      <div class="zmm-icon">⚠️</div>
      <div class="zmm-title serif">별자리가 달라요</div>
      <div class="zmm-body">
        입력하신 생년월일 기준 별자리는 <b class="hl-gold">${savedZodiac}</b>인데,<br>
        지금 <b style="color:var(--indigo-light)">${selectedZodiac}</b>를 선택하셨어요.
      </div>
      <div class="zmm-buttons">
        <button class="zmm-btn zmm-continue" id="zmm-continue">${selectedZodiac}로 계속하기</button>
        <button class="zmm-btn zmm-change" id="zmm-change">내 정보 수정하기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('zmm-continue').onclick = function() {
    overlay.remove();
    onContinue();
  };
  document.getElementById('zmm-change').onclick = function() {
    overlay.remove();
    showUserInfoModal();
  };
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

/* ── 후속 상담 유도 ── */
function getFollowUpMessage() {
  const u = getUserInfo();
  const name = u ? u.name : '고객';
  const msgs = [
    `위 내용은 ${name}님의 전체적인 흐름을 살펴본 거예요.\n하지만 하루하루의 운세는 지금 처한 상황에 따라 조금씩 달라지기도 한답니다.\n혹시 요즘 마음에 걸리는 일이 있으시다면, 편하게 말씀해 주세요.\n진심을 다해 살펴봐 드릴게요 🙏`,
    `지금까지 본 건 큰 흐름이에요.\n${name}님의 오늘은 또 다른 이야기를 품고 있을 수 있답니다.\n더 깊이 알고 싶은 부분이 있으시면 알려주세요.\n정성껏 봐드리겠습니다 ✨`,
    `운세는 날마다 조금씩 달라져요.\n오늘 ${name}님에게 특별히 와닿는 부분이 있거나 궁금한 점이 있으시다면 편하게 여쭤보세요.\n다아라가 곁에서 함께 살펴봐 드릴게요 🌙`,
    `${name}님만의 이야기는 여기서 끝이 아니에요.\n요즘 고민되는 일이나 앞으로 궁금한 점이 있다면 말씀해 주세요.\n별과 카드가 전하는 메시지를 더 세심하게 풀어드릴게요 💫`,
    `전체 흐름은 이렇지만, 지금 이 순간 ${name}님의 마음이 향하는 곳에 따라 운세의 결도 달라진답니다.\n더 알고 싶은 부분이 있으시면 부담 없이 물어봐 주세요 🍀`,
    `${name}님, 오늘의 기운은 어제와는 또 다르답니다.\n지금 가장 신경 쓰이는 일이 있으시면 말씀해 주세요.\n그 마음에 맞춰 더 자세히 풀어드릴게요 🌸`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function addFollowUp() {
  const msg = getFollowUpMessage();
  const followupHtml = `<div class="followup-prompt">
    <div class="followup-text">${msg.replace(/\n/g, '<br>')}</div>
    <div class="followup-input-wrap">
      <input type="text" class="followup-input" placeholder="궁금한 점을 편하게 말씀해 주세요..." onkeydown="if(event.key==='Enter')sendFollowUp(this)">
      <button class="followup-send" onclick="sendFollowUp(this.previousElementSibling)">보내기</button>
    </div>
  </div>`;
  // 마지막 봇 메시지의 버블에 이어붙이기
  const box = document.getElementById(currentMsgBoxId);
  const lastBot = box?.querySelector('.msg.bot:last-child');
  const bubble = lastBot?.querySelector('.msg-bubble') || lastBot?.querySelector('.palm-result-msg') || lastBot?.querySelector('.card-reveal-msg');
  if (bubble) {
    bubble.insertAdjacentHTML('beforeend', followupHtml);
  } else {
    addMsg('bot', followupHtml);
  }
}

function sendFollowUp(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  // 입력창 비활성화 (중복 전송 방지)
  inputEl.disabled = true;
  inputEl.nextElementSibling.disabled = true;
  const u = getUserInfo();
  const ctx = u ? `${u.name}님(${u.zodiac}, ${u.age}세 ${u.gender})이 ` : '';
  askClaude(`${ctx}방금 운세 결과를 보고 추가로 궁금한 점이 있어요: "${text}"\n\n이전 운세 흐름을 이어서, 지금 상황에 맞게 따뜻하고 구체적으로 3~4문장으로 답해 주세요. 마지막에 다아라의 따뜻한 한마디를 덧붙여 주세요.`, true, text);
}

/* ── API ── */
async function callAPI(body) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || 'API Error: ' + res.status); }
  return res.json();
}
async function callGeminiAPI(body) {
  const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || 'Gemini API Error: ' + res.status); }
  return res.json();
}
async function askClaude(overrideMsg, isAuto, userLabel, cacheKey = null, showFollowUp = false) {
  if (!canUseAPI()) {
    document.getElementById('limit-modal-overlay').style.display = 'flex';
    return;
  }
  // 캐시 히트
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) {
      if (userLabel) addMsg('user', userLabel);
      const cachedEl = addMsg('bot', cached);
      if (showFollowUp) addFollowUp();
      setTimeout(() => cachedEl.closest('.msg').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      return;
    }
  }
  const btn = document.getElementById('send-btn'), input = document.getElementById('chat-input');
  btn.disabled = true; input.disabled = true;
  if (userLabel) addMsg('user', userLabel);
  const typingEl = addMsg('bot', '생각하고 있어요···'); typingEl.classList.add('typing');
  const system = `당신은 따뜻하고 섬세한 AI 타로·운세·사주 상담사 '다아라'입니다.${getUserContext()}
사용자 감정에 먼저 공감해 주세요. 성별·나이에 관계없이 "~님"으로 호칭하며, 정중하고 따뜻한 존댓말을 씁니다. "오빠/언니/누나/형" 같은 호칭은 절대 쓰지 않습니다.
사용자의 이름, 별자리, 나이, 성별, 직업을 자연스럽게 반영해 개인화된 답변을 해주세요.
사주 정보(연주, 일주, 태어난 시)가 있으면 천간지지·오행의 기운을 해석에 녹여주세요.
오늘 날짜·요일·현재 시진과 사용자 위치의 계절감·기운을 자연스럽게 반영하세요.
직업이 있으면 직업 특성에 맞는 구체적 조언(직장운, 사업운, 학업운 등)을 포함하세요.
"~것 같아요", "~할 수 있어요" 처럼 단정 짓지 않고 부드럽게 표현합니다.
이모지를 1~2개 자연스럽게 씁니다. 3~6문장 내외로 간결하고 따뜻하게 마무리합니다.
답변은 항상 같은 사용자에 대한 일관된 흐름을 유지해 주세요.`;
  const messages = overrideMsg ? [{ role: 'user', content: overrideMsg }] : [...history];
  try {
    const data = await callGeminiAPI({ max_tokens: 4000, system, messages });
    const reply = data?.content?.[0]?.text || '잠깐 다시 시도해 주실 수 있어요? 😊';
    typingEl.classList.remove('typing'); typingEl.innerHTML = formatReply(reply);
    if (!isAuto) { history.push({ role: 'assistant', content: reply }); if (history.length > 12) history = history.slice(-12); }
    incrementUsage();
    if (cacheKey) setCached(cacheKey, formatReply(reply));
    updateUserBadge();
    if (showFollowUp) addFollowUp();
  } catch (e) {
    // Gemini 실패 시 Claude Haiku로 폴백
    try {
      const data = await callAPI({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000, system, messages });
      const reply = data?.content?.[0]?.text || '';
      typingEl.classList.remove('typing'); typingEl.innerHTML = formatReply(reply);
      if (!isAuto) { history.push({ role: 'assistant', content: reply }); if (history.length > 12) history = history.slice(-12); }
      incrementUsage();
      if (cacheKey) setCached(cacheKey, formatReply(reply));
      updateUserBadge();
      if (showFollowUp) addFollowUp();
    } catch {
      typingEl.classList.remove('typing');
      typingEl.innerHTML = '잠깐 연결이 끊겼어요. 조금 있다 다시 시도해 주세요 😊';
    }
  }
  btn.disabled = false; input.disabled = false; input.focus();
  setTimeout(() => typingEl.closest('.msg').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}
/* 타로 3카드 해석 — API 1회 호출, 결과를 카드별 3개 메시지로 분리 */
async function askClaudeTarot3(prompt, cards) {
  if (!canUseAPI()) {
    document.getElementById('limit-modal-overlay').style.display = 'flex';
    return;
  }
  const btn = document.getElementById('send-btn'), input = document.getElementById('chat-input');
  btn.disabled = true; input.disabled = true;
  const typingEl = addMsg('bot', '카드를 해석하고 있어요···'); typingEl.classList.add('typing');
  let firstCardEl = null;
  const system = `당신은 따뜻하고 섬세한 AI 타로·운세·사주 상담사 '다아라'입니다.${getUserContext()}
사용자 감정에 먼저 공감해 주세요. 성별·나이에 관계없이 "~님"으로 호칭하며, 정중하고 따뜻한 존댓말을 씁니다. "오빠/언니/누나/형" 같은 호칭은 절대 쓰지 않습니다.
사용자의 이름, 별자리, 나이, 성별, 직업을 자연스럽게 반영해 개인화된 답변을 해주세요.
사주 정보(연주, 일주, 태어난 시)가 있으면 천간지지·오행의 기운을 해석에 녹여주세요.
오늘 날짜·요일·현재 시진과 사용자 위치의 계절감·기운을 자연스럽게 반영하세요.
직업이 있으면 직업 특성에 맞는 구체적 조언을 포함하세요.
"~것 같아요", "~할 수 있어요" 처럼 단정 짓지 않고 부드럽게 표현합니다.
이모지를 1~2개 자연스럽게 씁니다.
답변은 항상 같은 사용자에 대한 일관된 흐름을 유지해 주세요.`;
  try {
    const data = await callGeminiAPI({ max_tokens: 3000, system, messages: [{ role: 'user', content: prompt }] });
    const reply = data?.content?.[0]?.text || '';
    typingEl.remove(); // typing 메시지 제거
    // 카드별로 분리: 🔮, 🌙, ⚠️, ✨ 기준
    const sections = reply.split(/(?=🔮|🌙|⚠️|✨)/);
    const cardEmojis = ['🔮', '🌙', '⚠️'];
    let cardIdx = 0;
    for (const sec of sections) {
      const trimmed = sec.trim();
      if (!trimmed) continue;
      if (cardIdx < 3 && cardEmojis.some(e => trimmed.startsWith(e))) {
        const el = addMsg('bot', formatReply(trimmed), 'text', cardIdx);
        if (cardIdx === 0) firstCardEl = el;
        cardIdx++;
      } else {
        addMsg('bot', formatReply(trimmed));
      }
    }
    incrementUsage();
    updateUserBadge();
    addFollowUp();
  } catch (e) {
    typingEl.classList.remove('typing');
    typingEl.innerHTML = '잠깐 연결이 끊겼어요. 조금 있다 다시 시도해 주세요 😊';
  }
  btn.disabled = false; input.disabled = false; input.focus();
  if (firstCardEl) setTimeout(() => firstCardEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}
async function sendMessage() {
  if (!ensureUserInfo(() => sendMessage())) return;
  currentMsgBoxId = 'messages'; // 자유 채팅은 항상 타로 패널
  const input = document.getElementById('chat-input');
  const text = input.value.trim(); if (!text) return;
  addMsg('user', text); input.value = '';
  history.push({ role: 'user', content: text });
  await askClaude(null, false, null);
}

/* ── 생년월일 커스텀 피커 ── */
function initBirthSelects(yId, mId, dId) {
  const yEl = document.getElementById(yId), mEl = document.getElementById(mId), dEl = document.getElementById(dId);
  if (!yEl || !mEl || !dEl) return;
  // 년·월·일 모두 커스텀 버튼으로 변환
  function makeBtn(el, label, groupId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'birth-pick-btn ' + el.className;
    btn.textContent = label;
    btn.dataset.value = '';
    btn.dataset.group = groupId;
    el.parentNode.replaceChild(btn, el);
    return btn;
  }
  const group = yId; // 그룹 식별자
  const yBtn = makeBtn(yEl, '년', group);
  const mBtn = makeBtn(mEl, '월', group);
  const dBtn = makeBtn(dEl, '일', group);
  yBtn.dataset.role = 'y'; mBtn.dataset.role = 'm'; dBtn.dataset.role = 'd';
  yBtn.addEventListener('click', () => openBirthPicker('year', yBtn, mBtn, dBtn));
  mBtn.addEventListener('click', () => openBirthPicker('month', yBtn, mBtn, dBtn));
  dBtn.addEventListener('click', () => openBirthPicker('day', yBtn, mBtn, dBtn));
}

/* ── 통합 팝업 피커 ── */
let bpOverlay = null;
let bpDecade = 1970;
const BP_MAX_YEAR = new Date().getFullYear();

function openBirthPicker(mode, yBtn, mBtn, dBtn) {
  if (mode === 'year') { bpDecade = Math.floor(BP_MAX_YEAR / 10) * 10; showBpYear(yBtn, mBtn, dBtn); }
  else if (mode === 'month') { showBpMonth(yBtn, mBtn, dBtn); }
  else { showBpDay(yBtn, mBtn, dBtn); }
}

function bpWrap(content) {
  if (bpOverlay) bpOverlay.remove();
  const ov = document.createElement('div');
  ov.className = 'bp-overlay';
  const pop = document.createElement('div');
  pop.className = 'bp-popup';
  pop.innerHTML = content;
  ov.appendChild(pop);
  ov.addEventListener('click', e => { if (e.target === ov) closeBp(); });
  document.body.appendChild(ov);
  bpOverlay = ov;
  return pop;
}

function closeBp() { if (bpOverlay) { bpOverlay.remove(); bpOverlay = null; } }

// 년도 피커
function showBpYear(yBtn, mBtn, dBtn) {
  const start = bpDecade, end = Math.min(bpDecade + 9, BP_MAX_YEAR);
  const prevVis = bpDecade > 1940 ? '' : 'visibility:hidden';
  const nextVis = bpDecade + 10 <= BP_MAX_YEAR ? '' : 'visibility:hidden';
  let items = '';
  for (let y = start; y <= end; y++) {
    const sel = yBtn.dataset.value === String(y) ? ' selected' : '';
    items += `<button class="bp-item${sel}" data-val="${y}">${y}년</button>`;
  }
  const pop = bpWrap(
    `<div class="bp-header"><button class="bp-nav" style="${prevVis}" data-dir="prev">◀</button><span class="bp-title">${start}~${end}</span><button class="bp-nav" style="${nextVis}" data-dir="next">▶</button></div>` +
    `<div class="bp-grid bp-grid-year">${items}</div>` +
    `<button class="bp-close-bottom" onclick="closeBp()">닫기</button>`
  );
  pop.querySelectorAll('.bp-nav').forEach(b => b.onclick = () => {
    bpDecade += b.dataset.dir === 'prev' ? -10 : 10;
    showBpYear(yBtn, mBtn, dBtn);
  });
  pop.querySelectorAll('.bp-item').forEach(b => b.onclick = () => {
    yBtn.dataset.value = b.dataset.val;
    yBtn.textContent = b.dataset.val + '년';
    yBtn.classList.add('has-value');
    closeBp();
  });
}

// 월 피커
function showBpMonth(yBtn, mBtn, dBtn) {
  let items = '';
  for (let m = 1; m <= 12; m++) {
    const mv = String(m).padStart(2, '0');
    const sel = mBtn.dataset.value === mv ? ' selected' : '';
    items += `<button class="bp-item${sel}" data-val="${mv}">${m}월</button>`;
  }
  const pop = bpWrap(
    `<div class="bp-header"><span class="bp-title">월 선택</span></div>` +
    `<div class="bp-grid bp-grid-month">${items}</div>` +
    `<button class="bp-close-bottom" onclick="closeBp()">닫기</button>`
  );
  pop.querySelectorAll('.bp-item').forEach(b => b.onclick = () => {
    mBtn.dataset.value = b.dataset.val;
    mBtn.textContent = parseInt(b.dataset.val) + '월';
    mBtn.classList.add('has-value');
    closeBp();
  });
}

// 일 피커
function showBpDay(yBtn, mBtn, dBtn) {
  const now = new Date();
  const y = parseInt(yBtn.dataset.value) || now.getFullYear();
  const m = parseInt(mBtn.dataset.value) || (now.getMonth() + 1);
  const days = new Date(y, m, 0).getDate();
  const firstDay = new Date(y, m - 1, 1).getDay(); // 0=일, 1=월...
  const dayNames = ['일','월','화','수','목','금','토'];
  let dayHeader = dayNames.map((d, i) => `<span class="bp-day-name${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${d}</span>`).join('');
  let items = '';
  // 1일 전 빈칸
  for (let e = 0; e < firstDay; e++) items += '<span class="bp-empty"></span>';
  for (let d = 1; d <= days; d++) {
    const dv = String(d).padStart(2, '0');
    const sel = dBtn.dataset.value === dv ? ' selected' : '';
    const dow = (firstDay + d - 1) % 7;
    const dayClass = dow === 0 ? ' sun' : dow === 6 ? ' sat' : '';
    items += `<button class="bp-item${sel}${dayClass}" data-val="${dv}">${d}</button>`;
  }
  const yLabel = y + '년 ';
  const mLabel = m + '월';
  const isPartner = yBtn.dataset.group && yBtn.dataset.group.includes('match');
  const calLabel = isPartner ? (matchPartnerCalendar || '양력') : (selectedCalendar || '양력');
  const pop = bpWrap(
    `<div class="bp-header"><span class="bp-title">${y}년 ${m}월 <span class="bp-cal-tag">${calLabel}</span></span></div>` +
    `<div class="bp-grid bp-grid-day">${dayHeader}${items}</div>` +
    `<button class="bp-close-bottom" onclick="closeBp()">닫기</button>`
  );
  pop.querySelectorAll('.bp-item').forEach(b => b.onclick = () => {
    dBtn.dataset.value = b.dataset.val;
    dBtn.textContent = parseInt(b.dataset.val) + '일';
    dBtn.classList.add('has-value');
    closeBp();
  });
}

function getBirthFromSelects(yId, mId, dId) {
  const g = document.querySelector(`.birth-pick-btn[data-group="${yId}"][data-role="y"]`);
  const gm = document.querySelector(`.birth-pick-btn[data-group="${yId}"][data-role="m"]`);
  const gd = document.querySelector(`.birth-pick-btn[data-group="${yId}"][data-role="d"]`);
  const y = g ? g.dataset.value : '';
  const m = gm ? gm.dataset.value : '';
  const d = gd ? gd.dataset.value : '';
  if (!y || !m || !d) return '';
  return `${y}-${m}-${d}`;
}
function setBirthSelects(yId, mId, dId, dateStr) {
  if (!dateStr) return;
  const [y, m, d] = dateStr.split('-');
  const g = document.querySelector(`.birth-pick-btn[data-group="${yId}"][data-role="y"]`);
  const gm = document.querySelector(`.birth-pick-btn[data-group="${yId}"][data-role="m"]`);
  const gd = document.querySelector(`.birth-pick-btn[data-group="${yId}"][data-role="d"]`);
  if (g) { g.dataset.value = y; g.textContent = y + '년'; g.classList.add('has-value'); }
  if (gm) { gm.dataset.value = m; gm.textContent = parseInt(m) + '월'; gm.classList.add('has-value'); }
  if (gd) { gd.dataset.value = d; gd.textContent = parseInt(d) + '일'; gd.classList.add('has-value'); }
}

/* ── 초기화 ── */
document.addEventListener('DOMContentLoaded', async () => {
  showOnboarding();
  initBirthSelects('um-birth-y', 'um-birth-m', 'um-birth-d');
  initBirthSelects('match-p-birth-y', 'match-p-birth-m', 'match-p-birth-d');
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
    addMsg('bot', `<b>${u.name}</b>님, 오늘의 운세가 준비됐어요 😊<br>어제와는 다른 흐름이 보여요. 카드를 뽑아 확인해 보세요 ✨<br><span style="font-size:11px;color:var(--text-muted)">지금 가장 많이 받는 상담: ${getPopularMenu()} 🔥</span>`);
  } else {
    addMsg('bot', `오늘 하루가 궁금하지 않으세요? 😊<br><b>다아라</b>가 AI로 당신만의 운세를 바로 봐드려요.<br><br>카드를 뽑거나 메뉴를 선택하면 <b class="hl-gold">무료로 바로 시작</b>할 수 있어요 ✨<br><span style="font-size:11px;color:var(--text-muted)">지금 가장 많이 받는 상담: ${getPopularMenu()} 🔥</span>`);
  }

  // 소셜 프루프 동적 업데이트
  const adBody = document.getElementById('ad-body');
  if (adBody) adBody.textContent = `오늘 ${getSocialCount('consulting')}명이 상담 중`;
  const limitSub = document.getElementById('limit-modal-sub');
  if (limitSub) limitSub.innerHTML = `오늘의 무료 상담 3회를 모두 사용했어요.<br><b>지금 ${getSocialCount('premium')}명이 프리미엄으로 상담 중이에요.</b>`;

});
