// 홍보실 이미지 중계 서버 (의존성 없음, Node 18+)
// 실행: OPENAI_API_KEY=sk-... node server/image-relay.js
// 키는 이 서버의 환경변수에만 두고, 웹페이지에는 넣지 않는다.
const http = require('http');

const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const PORT = process.env.PORT || 8787;
const TOKEN = process.env.RELAY_TOKEN || '';            // 선택: 설정하면 페이지에서 같은 값을 입력해야 호출 가능
const ORIGIN = process.env.ALLOW_ORIGIN || '*';          // 운영 시 페이지 주소로 제한 권장
const SIZES = ['1024x1024', '1024x1536', '1536x1024'];

if (!KEY) { console.error('OPENAI_API_KEY 환경변수가 필요합니다.'); process.exit(1); }

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || req.url !== '/api/image') return send(res, 404, { error: 'not found' });
  if (TOKEN && req.headers['x-relay-token'] !== TOKEN) return send(res, 401, { error: '토큰이 올바르지 않습니다.' });

  let body = '';
  for await (const c of req) { body += c; if (body.length > 1e5) return send(res, 413, { error: 'too large' }); }
  let p;
  try { p = JSON.parse(body); } catch { return send(res, 400, { error: 'JSON 형식 오류' }); }

  const prompt = String(p.prompt || '').trim();
  const size = SIZES.includes(p.size) ? p.size : '1024x1024';
  const n = Math.min(Math.max(parseInt(p.n) || 1, 1), 2);   // 채널당 시안 최대 2개
  if (!prompt) return send(res, 400, { error: 'prompt가 비어 있습니다.' });

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, prompt, size, n }),
    });
    const j = await r.json();
    if (!r.ok) return send(res, r.status, { error: j.error?.message || 'OpenAI 오류' });
    send(res, 200, { images: j.data.map(d => d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url) });
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
}).listen(PORT, () => console.log(`이미지 중계 서버: http://localhost:${PORT}/api/image (model ${MODEL})`));
