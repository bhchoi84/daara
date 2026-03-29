/* ── 운세 기능 (별자리·궁합·재물·오늘의 운세) ── */

async function runStar() {
  if (!ensureUserInfo(() => runStar())) return;
  if (!sel.a) { alert('별자리를 선택해 주세요!'); return; }
  goMenu('tarot', document.querySelector('.n-tarot'));
  const cacheKey = `star_${sel.a}`;
  await askClaude(`나는 ${sel.a}이에요. 오늘(${new Date().toLocaleDateString('ko-KR')}) 나의 별자리 운세를 애정운, 금전운, 건강운으로 나눠서 따뜻하고 구체적으로 알려주세요. 마지막에 오늘의 한마디로 마무리해 주세요.`, true, '⭐ 별자리 운세 요청', cacheKey);
}

let matchPartnerGender = '';
function selectMatchGender(val, el) {
  matchPartnerGender = val;
  document.querySelectorAll('.match-p-gender').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function updateMatchMyInfo() {
  const el = document.getElementById('match-my-info');
  if (!el) return;
  const u = getUserInfo();
  if (!u) { el.innerHTML = '<span class="match-info-placeholder">먼저 내 정보를 입력해 주세요 →</span>'; return; }
  let html = `<span class="match-info-filled"><b>${u.name}</b> · ${u.zodiac} · ${u.age}세 · ${u.gender}`;
  if (u.saju) html += ` · ${u.saju.year}년 ${u.saju.day}일`;
  if (u.siji) html += ` · ${u.siji.split('(')[0]}`;
  if (u.job) html += ` · ${u.job}`;
  html += `</span> <span style="font-size:11px;color:var(--text-muted)">수정 →</span>`;
  el.innerHTML = html;
}

function getPartnerInfo() {
  const name = document.getElementById('match-p-name').value.trim();
  const birth = document.getElementById('match-p-birth').value;
  if (!name || !birth) return null;
  const gender = matchPartnerGender || '선택안함';
  const siji = document.getElementById('match-p-siji').value;
  const job = document.getElementById('match-p-job').value.trim();
  const zodiac = getZodiac(birth);
  const age = new Date().getFullYear() - parseInt(birth.slice(0,4));
  const saju = getSaju(birth);
  return { name, birthdate: birth, gender, zodiac, age, saji: saju, siji, job };
}

async function runMatch() {
  if (!ensureUserInfo(() => runMatch())) return;
  const partner = getPartnerInfo();
  if (!partner) { alert('상대방의 이름과 생년월일을 입력해 주세요!'); return; }
  const rel = document.getElementById('match-rel').value;
  const u = getUserInfo();
  goMenu('tarot', document.querySelector('.n-tarot'));

  // 나의 사주 정보
  let myInfo = `${u.name}(${u.zodiac}, ${u.age}세, ${u.gender}`;
  if (u.saju) myInfo += `, 연주:${u.saju.year} 일주:${u.saju.day}`;
  if (u.siji) myInfo += `, ${u.siji.split('(')[0]}생`;
  if (u.job) myInfo += `, ${u.job}`;
  myInfo += ')';

  // 상대 사주 정보
  let pInfo = `${partner.name}(${partner.zodiac}, ${partner.age}세, ${partner.gender}`;
  if (partner.saji) pInfo += `, 연주:${partner.saji.year} 일주:${partner.saji.day}`;
  if (partner.siji) pInfo += `, ${partner.siji.split('(')[0]}생`;
  if (partner.job) pInfo += `, ${partner.job}`;
  pInfo += ')';

  const cacheKey = `match_${u.birthdate}_${partner.birthdate}_${rel}`;
  await askClaude(
    `궁합 분석을 부탁해요!\n` +
    `나: ${myInfo}\n상대: ${pInfo}\n관계: ${rel}\n\n` +
    `두 사람의 사주(천간지지·오행 상생상극), 별자리 궁합, 성격 궁합을 종합 분석해 주세요.\n` +
    `아래 형식으로 알려주세요:\n\n` +
    `💕 두 사람의 궁합 점수\n(100점 만점으로 총점과 한줄 요약)\n\n` +
    `🔥 잘 맞는 점\n(사주·별자리 기반 2~3가지)\n\n` +
    `⚡ 조심할 점\n(충돌 가능성 2~3가지)\n\n` +
    `💌 관계를 더 좋게 만드는 조언\n(구체적 행동 2~3가지)\n\n` +
    `✨ 다아라의 한마디\n(따뜻한 마무리)`,
    true, `♡ 궁합 분석 (${u.name} ↔ ${partner.name})`, cacheKey
  );
}

async function runMoney() {
  if (!ensureUserInfo(() => runMoney())) return;
  if (!sel.mo) { alert('별자리를 선택해 주세요!'); return; }
  const concern = document.getElementById('money-concern').value;
  const card = moneyCard ? `금전 타로 카드로 "${moneyCard.name}"(${moneyCard.keywords})이 나왔어요. ` : '';
  goMenu('tarot', document.querySelector('.n-tarot'));
  const cacheKey = `money_${sel.mo}_${moneyCard?.name || ''}`;
  await askClaude(`나는 ${sel.mo}이에요. ${card}${concern ? `요즘 "${concern}"에 대한 고민이 있어요. ` : ''}오늘의 금전 운세를 재물운 흐름, 주의할 점, 기회가 될 수 있는 것으로 나눠서 구체적이고 따뜻하게 알려주세요 💰`, true, `◈ 금전 운세 요청 (${sel.mo})`, cacheKey);
}

async function runToday() {
  if (!ensureUserInfo(() => runToday())) return;
  if (!sel.today) { alert('별자리를 선택해 주세요!'); return; }
  const concern = document.getElementById('today-concern').value;
  goMenu('tarot', document.querySelector('.n-tarot'));
  const cacheKey = `today_${sel.today}${concern ? '_c' : ''}`;
  await askClaude(
    `나는 ${sel.today}이에요. 오늘(${new Date().toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})의 전체 운세를 봐주세요.${concern ? ` 특히 "${concern}"에 대해 신경이 쓰여요.` : ''} 오늘의 총운, 애정운, 금전운, 건강운, 오늘의 행운 색깔/숫자를 포함해서 따뜻하고 구체적으로 알려주세요. 마지막에 오늘 하루를 위한 다아라의 한마디로 마무리해 주세요 🌅`,
    true, `🌅 오늘의 운세 (${sel.today})`, cacheKey
  );
}

/* ── 손금·관상 분석 ── */

function resizeImage(dataUrl, maxWidth = 1024) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

let palmMode = null; // 'right' | 'left' | 'face'

function selectPalmMode(mode, el) {
  palmMode = mode;
  document.querySelectorAll('.palm-mode-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const dropTitle = document.getElementById('palm-drop-title');
  const dropSub = document.getElementById('palm-drop-sub');
  if (mode === 'right') { dropTitle.textContent = '오른손 촬영'; dropSub.textContent = '손바닥이 보이게'; }
  else if (mode === 'left') { dropTitle.textContent = '왼손 촬영'; dropSub.textContent = '손바닥이 보이게'; }
  else { dropTitle.textContent = '얼굴 촬영'; dropSub.textContent = '정면으로 찍기'; }
  // 선택 후 스캐너 활성화 표시
  const scanner = document.querySelector('.palm-scanner');
  if (scanner) scanner.classList.add('ready');
}

function openPalmUpload() {
  if (!palmMode) {
    // 모드 미선택 시 버튼 강조 애니메이션
    const modeSelect = document.querySelector('.palm-mode-select');
    if (modeSelect) {
      modeSelect.classList.add('shake');
      setTimeout(() => modeSelect.classList.remove('shake'), 600);
    }
    return;
  }
  document.getElementById('palm-file').click();
}

function getPalmModeLabel() {
  if (palmMode === 'right') return '오른손';
  if (palmMode === 'left') return '왼손';
  if (palmMode === 'face') return '얼굴';
  return '';
}

function getPalmModeExpect() {
  if (palmMode === 'right') return '손바닥이 보이는 오른손 사진';
  if (palmMode === 'left') return '손바닥이 보이는 왼손 사진';
  if (palmMode === 'face') return '정면 얼굴 사진';
  return '';
}

function onPalmFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const resized = await resizeImage(ev.target.result, 1024);
    palmPreviewSrc = resized; palmImageData = resized.split(',')[1];
    const modeLabel = getPalmModeLabel();
    const modeExpect = getPalmModeExpect();
    const modeIcon = palmMode === 'face' ? '😊' : palmMode === 'right' ? '✋' : '🤚';
    const panel = document.getElementById('palm-panel');
    panel.innerHTML = `
  <div class="palm-header">
    <div class="palm-header-title serif">AI 손금·관상</div>
    <div class="palm-header-sub">사진이 준비됐어요</div>
  </div>
  <div class="palm-confirm-mode">
    <span class="palm-confirm-icon">${modeIcon}</span>
    <span class="palm-confirm-label">선택: <b>${modeLabel}</b></span>
    <span class="palm-confirm-hint">${modeExpect}이 맞나요?</span>
  </div>
  <div class="palm-preview-wrap">
    <img src="${palmPreviewSrc}" class="palm-preview-img" alt="${modeLabel} 사진">
    <div class="palm-preview-overlay"><button class="palm-analyze-btn" onclick="analyzePalm()">✨ AI 분석 시작하기</button></div>
  </div>
  <div class="palm-reupload-area">
    <p class="palm-reupload-hint">사진이 ${modeExpect}이 아니라면 다시 올려주세요</p>
    <button class="palm-reupload-btn" onclick="document.getElementById('pf2').click()">📷 다른 사진 선택</button>
    <button class="palm-reupload-btn palm-reset-btn" onclick="resetPalmPanel()">↩ 항목부터 다시 선택</button>
  </div>
  <input type="file" id="pf2" accept="image/*" onchange="onPalmFile(event)">`;
  };
  reader.readAsDataURL(file);
}

async function analyzePalm() {
  if (!ensureUserInfo(() => analyzePalm())) return;
  if (!palmImageData) return;
  if (!palmMode) { alert('오른손 / 왼손 / 관상 중 하나를 먼저 선택해 주세요!'); return; }
  if (!canUseAPI()) { document.getElementById('limit-modal-overlay').style.display = 'flex'; return; }
  goMenu('tarot', document.querySelector('.n-tarot'));
  const btn = document.getElementById('send-btn'), input = document.getElementById('chat-input');
  btn.disabled = true; input.disabled = true;
  const modeLabel = palmMode === 'right' ? '오른손 손금' : palmMode === 'left' ? '왼손 손금' : '관상';
  addMsg('user', `<div class="user-palm-preview"><img src="${palmPreviewSrc}" alt="${modeLabel}"><span>다아라, ${modeLabel} 분석 부탁해요!</span></div>`);
  const typingEl = addMsg('bot', '사진을 찬찬히 살펴보고 있어요···'); typingEl.classList.add('typing');
  let system, userText, resultTitle, resultSub;
  const ctx = getUserContext();
  if (palmMode === 'right' || palmMode === 'left') {
    const hand = palmMode === 'right' ? '오른손' : '왼손';
    system = `당신은 따뜻하고 섬세한 AI 손금 상담사 '다아라'입니다.${ctx}
사용자가 보내준 ${hand} 사진을 보고 감정선·지능선·생명선·운명선을 분석합니다.
${palmMode === 'right' ? '오른손은 현재와 미래, 현실에서 실제로 펼쳐지는 운세를 봅니다.' : '왼손은 타고난 잠재력과 근본적인 기질, 가능성을 봅니다.'}
각 선마다 1~2문장씩 작성하고 마지막엔 따뜻한 격려로 마무리해 주세요.
오늘 날짜와 사용자의 현재 위치 기운을 자연스럽게 반영해 주세요.
말투: 친한 언니처럼 따뜻하고 공감 어린 존댓말. 단정 짓지 않고 가능성으로 이야기해 주세요.`;
    userText = `이 ${hand}의 손금을 감정선, 지능선, 생명선, 운명선 순으로 따뜻하게 분석해 주세요.`;
    resultTitle = palmMode === 'right' ? '✋ 오른손 손금 분석' : '🤚 왼손 손금 분석';
    resultSub = palmMode === 'right' ? '현재·미래 — 감정선 · 지능선 · 생명선 · 운명선' : '잠재력·기질 — 감정선 · 지능선 · 생명선 · 운명선';
  } else {
    system = `당신은 따뜻하고 섬세한 AI 관상 상담사 '다아라'입니다.${ctx}
사용자가 보내준 얼굴 사진을 보고 이마·눈썹·눈·코·입 순으로 관상을 분석합니다.
각 부위마다 1~2문장씩 작성하고 마지막엔 따뜻한 격려로 마무리해 주세요.
오늘 날짜와 사용자의 현재 위치 기운을 자연스럽게 반영해 주세요.
말투: 친한 언니처럼 따뜻하고 공감 어린 존댓말. 단정 짓지 않고 가능성으로 이야기해 주세요.`;
    userText = '이 얼굴의 관상을 이마, 눈썹, 눈, 코, 입 순으로 따뜻하게 분석해 주세요.';
    resultTitle = '👁 관상 분석 결과';
    resultSub = '이마 · 눈썹 · 눈 · 코 · 입';
  }
  try {
    const res = await callAPI({ model: 'claude-sonnet-4-6', max_tokens: 700, system, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: palmImageData } }, { type: 'text', text: userText }] }] });
    const reply = res?.content?.[0]?.text || '사진이 잘 보이지 않아요. 더 밝은 곳에서 다시 찍어 올려주시겠어요? 😊';
    typingEl.classList.remove('typing'); typingEl.className = 'palm-result-msg';
    typingEl.innerHTML = `<div class="palm-result-header"><img src="${palmPreviewSrc}" class="palm-result-thumb" alt="${modeLabel}"><div><div class="palm-result-title">${resultTitle}</div><div class="palm-result-sub">${resultSub}</div></div></div><div class="palm-result-text">${formatReply(reply)}</div>`;
    incrementUsage(); updateUserBadge();
  } catch (err) {
    console.error('Palm analysis error:', err);
    typingEl.classList.remove('typing'); typingEl.innerHTML = '분석 중 오류가 생겼어요. 잠깐 후 다시 시도해 주세요 😊<br><small style="opacity:0.5">' + (err.message || '') + '</small>';
  }
  btn.disabled = false; input.disabled = false; input.focus();
  document.getElementById('messages').scrollTop = 99999;
  palmImageData = null; palmPreviewSrc = null;
  resetPalmPanel();
}

function resetPalmPanel() {
  palmMode = null;
  document.getElementById('palm-panel').innerHTML = `
<div class="palm-header">
  <div class="palm-header-title serif">AI 손금·관상</div>
  <div class="palm-header-sub">먼저 항목을 선택해 주세요</div>
</div>
<div class="palm-mode-select">
  <button class="palm-mode-btn" onclick="selectPalmMode('right',this)"><span class="palm-mode-icon">✋</span><span class="palm-mode-label">오른손</span></button>
  <button class="palm-mode-btn" onclick="selectPalmMode('left',this)"><span class="palm-mode-icon">🤚</span><span class="palm-mode-label">왼손</span></button>
  <button class="palm-mode-btn" onclick="selectPalmMode('face',this)"><span class="palm-mode-icon">😊</span><span class="palm-mode-label">관상</span></button>
</div>
<div class="palm-scanner" onclick="openPalmUpload()">
  <div class="palm-scanner-ring"></div>
  <div class="palm-scanner-ring palm-scanner-ring-outer"></div>
  <div class="palm-scanner-inner">
    <div class="palm-scanner-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div>
    <div class="palm-scanner-text" id="palm-drop-title">사진 업로드</div>
    <div class="palm-scanner-sub" id="palm-drop-sub">탭하여 스캔 시작</div>
  </div>
</div>
<input type="file" id="palm-file" accept="image/*" onchange="onPalmFile(event)">
<div class="palm-guide-grid">
  <div class="palm-guide-card">
    <div class="palm-guide-card-header"><div class="palm-guide-dot" style="background:#d3bbff"></div><span class="palm-guide-card-label" style="color:#d3bbff">Palm Lines</span></div>
    <div class="palm-guide-items">
      <div class="palm-guide-row"><span>감정선</span><div class="palm-guide-bar" style="background:#d3bbff;width:70%"></div></div>
      <div class="palm-guide-row"><span>지능선</span><div class="palm-guide-bar" style="background:#8ad4c5;width:60%"></div></div>
      <div class="palm-guide-row"><span>생명선</span><div class="palm-guide-bar" style="background:#e1c471;width:75%"></div></div>
      <div class="palm-guide-row"><span>운명선</span><div class="palm-guide-bar" style="background:#d3bbff;width:50%"></div></div>
    </div>
  </div>
  <div class="palm-guide-card">
    <div class="palm-guide-card-header"><div class="palm-guide-dot" style="background:#e1c471"></div><span class="palm-guide-card-label" style="color:#e1c471">Face Zones</span></div>
    <div class="palm-guide-items">
      <div class="palm-guide-row-bar"><span>이마·눈썹</span><div class="palm-bar-track"><div class="palm-bar-fill" style="width:65%;background:linear-gradient(90deg,rgba(225,196,113,0.2),#e1c471)"></div></div></div>
      <div class="palm-guide-row-bar"><span>눈·코·입</span><div class="palm-bar-track"><div class="palm-bar-fill" style="width:50%;background:linear-gradient(90deg,rgba(138,212,197,0.2),#8ad4c5)"></div></div></div>
    </div>
  </div>
</div>`;
}
