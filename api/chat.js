/**
 * 운 다아라 API 서버리스 함수
 *
 * [API 키 관리 방식]
 * - API 키는 Vercel 환경변수(ANTHROPIC_API_KEY)에만 저장
 * - 브라우저(프론트엔드)에는 절대 전달되지 않음
 * - 모든 Anthropic API 호출은 이 서버에서만 발생
 * - 브라우저 → /api/chat (키 없음) → Anthropic API (키 있음)
 */
export default async function handler(req, res) {
  /* CORS 설정 */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  /* API 키 확인 (서버 환경변수에서만 읽음) */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  /* 요청 유효성 검사 */
  const { model, max_tokens, system, messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  /* Anthropic API 호출 */
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'API error' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
