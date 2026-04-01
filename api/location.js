/**
 * 카카오 로컬 API 프록시 — 좌표 → 주소 변환
 *
 * API 키는 Vercel 환경변수(KAKAO_REST_API_KEY)에만 저장
 * 브라우저 → /api/location?lat=...&lon=... → 카카오 API (키 있음)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Kakao API key not configured' });
  }

  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat, lon required' });
  }

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lon}&y=${lat}`,
      { headers: { 'Authorization': `KakaoAK ${apiKey}` } }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || 'Kakao API error' });
    }

    const addr = data?.documents?.[0]?.address;
    if (!addr) {
      return res.status(200).json({ city: '', region: '', country: '대한민국' });
    }

    return res.status(200).json({
      city: `${addr.region_2depth_name} ${addr.region_3depth_name}`.trim(),
      region: addr.region_1depth_name || '',
      country: '대한민국'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
