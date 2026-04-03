/* ── 타로 카드 뽑기 & 해석 ── */

/* 카드 한 장씩 뒤집기 */
function flipOne(i) {
  if (!ensureUserInfo(() => flipOne(i))) return;
  currentMsgBoxId = 'messages';
  // 아직 전체 뽑기 안 한 경우 → 그 자리 카드만 랜덤 배정
  if (!drawnCards) {
    const pool = [...CARDS].sort(() => Math.random() - 0.5);
    drawnCards = [pool[0], pool[1], pool[2]];
  }
  if (flippedCards[i]) return; // 이미 뒤집힌 카드 클릭 방지
  flippedCards[i] = true;
  const el = document.getElementById('sc' + i);
  el.classList.remove('unflipped');
  el.classList.add('revealed');
  el.querySelector('.card-sym').innerHTML = drawnCards[i].sym;
  const c = drawnCards[i];
  const allFlipped = flippedCards.every(f => f);
  const hintEl = document.getElementById('card-hint');
  if (allFlipped) {
    hintEl.textContent = '카드가 모두 열렸어요 ✨';
    setTimeout(() => {
      const summaryHtml = drawnCards.map((c, idx) =>
        `<div class="crb-summary-item" onclick="scrollToCardResult(${idx})" data-idx="${idx}">` +
          `<div class="crb-pos">${CARD_POS[idx]}</div>` +
          `<div class="crb-card"><div class="crb-sym">${c.sym}</div><div><div class="crb-name">${c.name}</div><div class="crb-en">${c.en}</div></div></div>` +
          `<span class="crb-keywords">${c.keywords}</span>` +
        `</div>`
      ).join('');
      addMsg('bot', `<div class="crb-summary">${summaryHtml}</div>`, 'card-reveal');
      const u = getUserInfo();
      const ctx = u ? `${u.name}님(${u.zodiac}, ${u.age}세 ${u.gender})의 ` : '';
      askClaudeTarot3(`${ctx}타로 3카드: 오늘의 카드 ${drawnCards[0].name}(${drawnCards[0].keywords}), 미래의 카드 ${drawnCards[1].name}(${drawnCards[1].keywords}), 주의할 일의 카드 ${drawnCards[2].name}(${drawnCards[2].keywords}). 아래 형식으로 각 카드별 해석을 줄바꿈으로 구분해서 알려주세요:\n\n🔮 오늘의 카드 — [카드명] (키워드)\n(3~4문장 해석)\n\n🌙 미래의 카드 — [카드명] (키워드)\n(3~4문장 해석)\n\n⚠️ 주의할 일 — [카드명] (키워드)\n(3~4문장 해석)\n\n✨ 운 다아라의 한마디\n(따뜻한 마무리 1문장)\n\n별자리 특성과 연결해 따뜻하고 구체적으로 해석해 주세요.`, drawnCards);
    }, 300);
  } else {
    const remaining = 3 - flippedCards.filter(f => f).length;
    hintEl.textContent = `${remaining}장 남았어요`;
    const cardEl = addMsg('bot', `<div class="card-reading-block"><div class="crb-pos">${CARD_POS[i]}</div><div class="crb-card"><div class="crb-sym">${c.sym}</div><div><div class="crb-name">${c.name}</div><div class="crb-en">${c.en}</div></div></div><span class="crb-keywords">${c.keywords}</span></div>`, 'card-reveal', i);
    setTimeout(() => cardEl.closest('.msg').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    const u = getUserInfo();
    const ctx = u ? `${u.name}님(${u.zodiac}, ${u.age}세 ${u.gender})에게 ` : '';
    askClaude(`${ctx}"${c.name}" 카드(${c.en}, 키워드: ${c.keywords})가 "${CARD_POS[i]}" 자리에 나왔어요. 이 카드가 지금 이 자리에서 전하는 메시지를 별자리 특성과 연결해 따뜻하고 공감 어린 말투로 2~3문장으로 이야기해 주세요.`, true, null);
  }
}

function drawMoneyCard() {
  moneyCard = CARDS[Math.floor(Math.random() * CARDS.length)];
  document.getElementById('money-card-sym').innerHTML = moneyCard.sym;
  document.getElementById('money-card-name').textContent = moneyCard.name + ' — ' + moneyCard.keywords;
  document.getElementById('money-card-box').classList.add('drawn');
}

function drawCards() {
  if (!ensureUserInfo(() => drawCards())) return;
  currentMsgBoxId = 'messages';
  const btn = document.getElementById('draw-btn');
  btn.disabled = true; btn.textContent = '뽑는 중...';
  // 상태 초기화
  flippedCards = [false, false, false];
  const s = [...CARDS].sort(() => Math.random() - 0.5);
  drawnCards = [s[0], s[1], s[2]];
  setTimeout(() => {
    drawnCards.forEach((c, i) => {
      const el = document.getElementById('sc' + i);
      el.classList.remove('unflipped');
      el.classList.add('revealed');
      el.querySelector('.card-sym').innerHTML = c.sym;
      flippedCards[i] = true;
    });
    document.getElementById('card-hint').textContent = '카드가 모두 열렸어요 ✨';
    btn.textContent = '다시 뽑기'; btn.disabled = false;
    // 3장 요약 카드 (클릭 시 개별 해석으로 이동)
    const summaryHtml = drawnCards.map((c, i) =>
      `<div class="crb-summary-item" onclick="scrollToCardResult(${i})" data-idx="${i}">` +
        `<div class="crb-pos">${CARD_POS[i]}</div>` +
        `<div class="crb-card"><div class="crb-sym">${c.sym}</div><div><div class="crb-name">${c.name}</div><div class="crb-en">${c.en}</div></div></div>` +
        `<span class="crb-keywords">${c.keywords}</span>` +
      `</div>`
    ).join('');
    addMsg('bot', `<div class="crb-summary">${summaryHtml}</div>`, 'card-reveal');
    const u = getUserInfo();
    const ctx = u ? `${u.name}님(${u.zodiac}, ${u.age}세 ${u.gender})의 ` : '';
    askClaudeTarot3(`${ctx}타로 3카드: 오늘의 카드 ${drawnCards[0].name}(${drawnCards[0].keywords}), 미래의 카드 ${drawnCards[1].name}(${drawnCards[1].keywords}), 주의할 일의 카드 ${drawnCards[2].name}(${drawnCards[2].keywords}). 아래 형식으로 각 카드별 해석을 줄바꿈으로 구분해서 알려주세요:\n\n🔮 오늘의 카드 — [카드명] (키워드)\n(3~4문장 해석)\n\n🌙 미래의 카드 — [카드명] (키워드)\n(3~4문장 해석)\n\n⚠️ 주의할 일 — [카드명] (키워드)\n(3~4문장 해석)\n\n✨ 운 다아라의 한마디\n(따뜻한 마무리 1문장)\n\n별자리 특성과 연결해 따뜻하고 구체적으로 해석해 주세요.`, drawnCards);
  }, 700);
}

function scrollToCardResult(i) {
  // 개별 해석 메시지(data-card-index)로 스크롤
  const msg = document.querySelector(`[data-card-index="${i}"]`);
  if (msg) {
    goMenu('tarot', document.querySelector('.n-tarot'));
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    msg.style.transition = 'background 0.3s';
    msg.style.background = 'rgba(99,102,241,0.1)';
    setTimeout(() => msg.style.background = '', 1200);
    return;
  }
  // 폴백
  scrollToCardMsg(i);
}

function selectSpread(i) {
  if (!drawnCards || !flippedCards[i]) return;
  document.querySelectorAll('.mini-card').forEach((el, j) => el.classList.toggle('selected', j === i));
  const c = drawnCards[i];
  const u = getUserInfo();
  const ctx = u ? `${u.name}님(${u.zodiac}, ${u.age}세 ${u.gender})에게 ` : '';
  askClaude(`${ctx}"${c.name}" 카드(${c.en}, ${c.keywords})가 "${CARD_POS[i]}" 자리. 별자리 특성과 연결해 2~3문장으로 공감 어린 말투로 해석해 주세요.`, true, null);
}
