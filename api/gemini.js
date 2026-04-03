/**
 * 운 다아라 Gemini API 서버리스 함수
 *
 * [API 키 관리 방식]
 * - API 키는 Vercel 환경변수(GEMINI_API_KEY)에만 저장
 * - 브라우저(프론트엔드)에는 절대 전달되지 않음
 * - 브라우저 → /api/gemini (키 없음) → Gemini API (키 있음)
 *
 * Anthropic 형식으로 요청 받아서 Gemini 형식으로 변환 후 호출,
 * 결과를 다시 Anthropic 형식으로 변환해서 반환 (프론트엔드 수정 최소화)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  const { system, messages, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  /* Anthropic 형식 → Gemini 형식 변환 (텍스트 + 이미지 지원) */
  const geminiContents = messages.map(m => {
    const parts = [];
    if (typeof m.content === 'string') {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'text') {
          parts.push({ text: c.text });
        } else if (c.type === 'image' && c.source?.type === 'base64') {
          parts.push({ inlineData: { mimeType: c.source.media_type, data: c.source.data } });
        }
      }
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });

  const geminiBody = {
    contents: geminiContents,
    generationConfig: {
      maxOutputTokens: max_tokens || 4000,
      temperature: 0.8,
    },
  };

  if (system) {
    geminiBody.systemInstruction = { parts: [{ text: system }] };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || 'Gemini API error';
      return res.status(response.status).json({ error: { message: errMsg } });
    }

    /* Gemini 응답 → Anthropic 형식으로 변환 */
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
