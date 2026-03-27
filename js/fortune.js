/* ── 운세 기능 (별자리·궁합·재물·오늘의 운세) ── */

async function runStar() {
  if (!ensureUserInfo(() => runStar())) return;
  if (!sel.a) { alert('별자리를 선택해 주세요!'); return; }
  goMenu('tarot', document.querySelector('.n-tarot'));
  const cacheKey = `star_${sel.a}`;
  await askClaude(`나는 ${sel.a}이에요. 오늘(${new Date().toLocaleDateString('ko-KR')}) 나의 별자리 운세를 애정운, 금전운, 건강운으로 나눠서 따뜻하고 구체적으로 알려주세요. 마지막에 오늘의 한마디로 마무리해 주세요.`, true, '⭐ 별자리 운세 요청', cacheKey);
}

async function runMatch() {
  if (!ensureUserInfo(() => runMatch())) return;
  if (!sel.m1 || !sel.m2) { alert('두 사람의 별자리를 모두 선택해 주세요!'); return; }
  const rel = document.getElementById('match-rel').value;
  goMenu('tarot', document.querySelector('.n-tarot'));
  const cacheKey = `match_${sel.m1}_${sel.m2}_${rel}`;
  await askClaude(`나는 ${sel.m1}이고, 상대방은 ${sel.m2}예요. 우리는 ${rel} 사이에요. 두 별자리의 궁합을 분석해 주세요. 잘 맞는 점, 조심해야 할 점, 관계를 더 좋게 만들 수 있는 따뜻한 조언도 함께 알려주세요 💕`, true, `♡ 궁합 요청 (${sel.m1} ↔ ${sel.m2})`, cacheKey);
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

let palmMode = null; // 'right' | 'left' | 'face'

function selectPalmMode(mode, el) {
  palmMode = mode;
  document.querySelectorAll('.palm-mode-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const dropTitle = document.getElementById('palm-drop-title');
  const dropSub = document.getElementById('palm-drop-sub');
  if (mode === 'right') { dropTitle.textContent = '오른손 사진을 올려주세요'; dropSub.textContent = '오른손 손바닥이 잘 보이도록 찍어 올려주세요 ✋'; }
  else if (mode === 'left') { dropTitle.textContent = '왼손 사진을 올려주세요'; dropSub.textContent = '왼손 손바닥이 잘 보이도록 찍어 올려주세요 🤚'; }
  else { dropTitle.textContent = '얼굴 사진을 올려주세요'; dropSub.textContent = '정면 얼굴이 잘 보이도록 찍어 올려주세요 😊'; }
}

function onPalmFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    palmPreviewSrc = ev.target.result; palmImageData = ev.target.result.split(',')[1];
    const panel = document.getElementById('palm-panel');
    panel.innerHTML = `
  <div class="palm-preview-wrap">
    <img src="${palmPreviewSrc}" class="palm-preview-img" alt="손금 사진">
    <div class="palm-preview-overlay"><button class="palm-analyze-btn" onclick="analyzePalm()">✋ 손금 분석 시작</button></div>
  </div>
  <p style="font-size:11px;color:var(--text-muted);text-align:center">버튼을 누르면 다아라가 바로 분석해 드려요 😊</p>
  <p class="palm-change-link" onclick="document.getElementById('pf2').click()">다른 사진 선택</p>
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
  if (palmMode === 'right' || palmMode === 'left') {
    const hand = palmMode === 'right' ? '오른손' : '왼손';
    system = `당신은 따뜻하고 섬세한 AI 손금 상담사 '다아라'입니다.
사용자가 보내준 ${hand} 사진을 보고 감정선·지능선·생명선·운명선을 분석합니다.
${palmMode === 'right' ? '오른손은 현재와 미래, 현실에서 실제로 펼쳐지는 운세를 봅니다.' : '왼손은 타고난 잠재력과 근본적인 기질, 가능성을 봅니다.'}
각 선마다 1~2문장씩 작성하고 마지막엔 따뜻한 격려로 마무리해 주세요.
말투: 친한 언니처럼 따뜻하고 공감 어린 존댓말. 단정 짓지 않고 가능성으로 이야기해 주세요.`;
    userText = `이 ${hand}의 손금을 감정선, 지능선, 생명선, 운명선 순으로 따뜻하게 분석해 주세요.`;
    resultTitle = palmMode === 'right' ? '✋ 오른손 손금 분석' : '🤚 왼손 손금 분석';
    resultSub = palmMode === 'right' ? '현재·미래 — 감정선 · 지능선 · 생명선 · 운명선' : '잠재력·기질 — 감정선 · 지능선 · 생명선 · 운명선';
  } else {
    system = `당신은 따뜻하고 섬세한 AI 관상 상담사 '다아라'입니다.
사용자가 보내준 얼굴 사진을 보고 이마·눈썹·눈·코·입 순으로 관상을 분석합니다.
각 부위마다 1~2문장씩 작성하고 마지막엔 따뜻한 격려로 마무리해 주세요.
말투: 친한 언니처럼 따뜻하고 공감 어린 존댓말. 단정 짓지 않고 가능성으로 이야기해 주세요.`;
    userText = '이 얼굴의 관상을 이마, 눈썹, 눈, 코, 입 순으로 따뜻하게 분석해 주세요.';
    resultTitle = '👁 관상 분석 결과';
    resultSub = '이마 · 눈썹 · 눈 · 코 · 입';
  }
  try {
    const res = await callAPI({ model: 'claude-sonnet-4-6', max_tokens: 700, system, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: palmImageData } }, { type: 'text', text: userText }] }] });
    const reply = res?.content?.[0]?.text || '사진이 잘 보이지 않아요. 더 밝은 곳에서 다시 찍어 올려주시겠어요? 😊';
    typingEl.classList.remove('typing'); typingEl.className = 'palm-result-msg';
    typingEl.innerHTML = `<div class="palm-result-header"><img src="${palmPreviewSrc}" class="palm-result-thumb" alt="${modeLabel}"><div><div class="palm-result-title">${resultTitle}</div><div class="palm-result-sub">${resultSub}</div></div></div><div class="palm-result-text">${reply.replace(/\n/g, '<br>')}</div>`;
    incrementUsage(); updateUserBadge();
  } catch (err) {
    typingEl.classList.remove('typing'); typingEl.innerHTML = '분석 중 오류가 생겼어요. 잠깐 후 다시 시도해 주세요 😊';
  }
  btn.disabled = false; input.disabled = false; input.focus();
  document.getElementById('messages').scrollTop = 99999;
  palmImageData = null; palmPreviewSrc = null;
  resetPalmPanel();
}

function resetPalmPanel() {
  palmMode = null;
  document.getElementById('palm-panel').innerHTML = `
<div class="palm-mode-select">
  <button class="palm-mode-btn" onclick="selectPalmMode('right',this)">✋ 오른손</button>
  <button class="palm-mode-btn" onclick="selectPalmMode('left',this)">🤚 왼손</button>
  <button class="palm-mode-btn" onclick="selectPalmMode('face',this)">😊 관상</button>
</div>
<div class="palm-drop" onclick="document.getElementById('palm-file').click()">
  <div class="palm-drop-icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/><path d="m9 9 3 3-3 3"/><path d="m15 9-3 3 3 3"/></svg>
  </div>
  <div class="palm-drop-title" id="palm-drop-title">먼저 항목을 선택해 주세요</div>
  <div class="palm-drop-sub" id="palm-drop-sub">위에서 오른손 · 왼손 · 관상 중 하나를 선택하세요</div>
</div>
<input type="file" id="palm-file" accept="image/*" onchange="onPalmFile(event)">
<div class="palm-guide">
  <div class="palm-guide-title">다아라가 분석하는 항목</div>
  <div class="palm-guide-grid">
    <div class="palm-line"><div class="palm-line-dot" style="background:#F472B6;"></div><div class="palm-line-text"><div class="palm-line-name">감정선</div>사랑·감수성</div></div>
    <div class="palm-line"><div class="palm-line-dot" style="background:#818CF8;"></div><div class="palm-line-text"><div class="palm-line-name">지능선</div>사고방식·재능</div></div>
    <div class="palm-line"><div class="palm-line-dot" style="background:#34D399;"></div><div class="palm-line-text"><div class="palm-line-name">생명선</div>활력·건강</div></div>
    <div class="palm-line"><div class="palm-line-dot" style="background:#FBBF24;"></div><div class="palm-line-text"><div class="palm-line-name">운명선</div>커리어·방향</div></div>
    <div class="palm-line"><div class="palm-line-dot" style="background:#60A5FA;"></div><div class="palm-line-text"><div class="palm-line-name">이마·눈썹</div>운세·성격</div></div>
    <div class="palm-line"><div class="palm-line-dot" style="background:#F59E0B;"></div><div class="palm-line-text"><div class="palm-line-name">눈·코·입</div>인연·재물</div></div>
  </div>
</div>`;
}
