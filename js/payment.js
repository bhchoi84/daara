/* ── 토스페이먼츠 결제 ── */
// 테스트 키: test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq
// 운영 키로 교체 시 live_ck_... 로 변경
const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

let selectedPriceDays = 1; // 기본: 1일 99원

function selectPriceOpt(days) {
  selectedPriceDays = days;
  document.getElementById('price-opt-1').classList.toggle('price-selected', days === 1);
  document.getElementById('price-opt-30').classList.toggle('price-selected', days === 30);
  const btn = document.getElementById('limit-pay-btn');
  btn.textContent = days === 1 ? '99원으로 오늘 바로 시작' : '1,900원으로 30일 시작';
}

async function startPayment() {
  const btn = document.getElementById('limit-pay-btn');
  const amount = selectedPriceDays === 1 ? 99 : 1900;
  const label = selectedPriceDays === 1 ? '다아라 프리미엄 1일' : '다아라 프리미엄 30일';
  btn.disabled = true; btn.textContent = '결제창 열기···';
  try {
    const toss = TossPayments(TOSS_CLIENT_KEY);
    const u = getUserInfo();
    const orderId = 'daara_' + getToday().replace(/-/g,'') + '_' + Math.random().toString(36).slice(2,8);
    const baseUrl = window.location.origin + window.location.pathname;
    await toss.requestPayment('카드', {
      amount,
      orderId,
      orderName: label,
      customerName: u?.name || '사용자',
      successUrl: baseUrl + '?payment=success',
      failUrl: baseUrl + '?payment=fail',
    });
  } catch (e) {
    btn.disabled = false; btn.textContent = selectedPriceDays === 1 ? '99원으로 오늘 바로 시작' : '1,900원으로 30일 시작';
    if (e.code !== 'USER_CANCEL') {
      addMsg('bot', '결제 중 오류가 생겼어요. 잠깐 후 다시 시도해 주세요 😊');
      document.getElementById('limit-modal-overlay').style.display = 'none';
    }
  }
}

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

function handlePaymentFail(code, message) {
  if (code !== 'PAY_PROCESS_CANCELED') {
    addMsg('bot', `결제가 완료되지 않았어요 (${message || code}). 다시 시도해 주실 수 있어요? 😊`);
  }
}
