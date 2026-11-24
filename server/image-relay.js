// 홍보실 이미지 중계 서버 (의존성 없음, Node 18+) - Gemini / OpenAI 지원
// 실행: node server/image-relay.js  (키는 홍보실.env.local의 GEMINI_API_KEY)
// 키는 이 서버의 환경변수에만 두고, 웹페이지에는 넣지 않는다.
const fs = require('fs');
const path = require('path');
// ENV_DIR(기본: 저장소의 홍보실 폴더)의 홍보실.env → 홍보실.env.local 순으로 읽는다. 이미 설정된 환경변수가 우선.
const ENV_DIR = process.env.ENV_DIR || path.join(__dirname, '..', '홍보실');
for (const f of ['홍보실.env', '홍보실.env.local']) {
  try {
    for (const line of fs.readFileSync(path.join(ENV_DIR, f), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[2] && !(m[1] in process.env && f === '홍보실.env')) process.env[m[1]] = m[2];
    }
  } catch {}
}
const http = require('http');

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
// Google 키(AIza...)가 OPENAI_API_KEY 칸에 들어가 있어도 Gemini로 인식한다.
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || (OPENAI_KEY.startsWith('AIza') ? OPENAI_KEY : '');
const PROVIDER = process.env.IMAGE_PROVIDER || (GEMINI_KEY ? 'gemini' : 'openai');
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const GEMINI_BASE = process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com';
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const PORT = process.env.PORT || 8787;
const TOKEN = process.env.RELAY_TOKEN || '';            // 선택: 설정하면 페이지에서 같은 값을 입력해야 호출 가능
const ORIGIN = process.env.ALLOW_ORIGIN || '*';          // 운영 시 페이지 주소로 제한 권장
const SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

if (PROVIDER === 'gemini' && !GEMINI_KEY) { console.error('GEMINI_API_KEY가 필요합니다. 홍보실.env.local을 확인하세요.'); process.exit(1); }
if (PROVIDER === 'openai' && !OPENAI_KEY) { console.error('OPENAI_API_KEY가 필요합니다. 홍보실.env.local을 확인하세요.'); process.exit(1); }

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function geminiOne(prompt, ratio) {
  const r = await fetch(`${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ratio } },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new ApiError(r.status, j.error?.message || 'Gemini 오류');
  const parts = j.candidates?.[0]?.content?.parts || [];
  const img = parts.find(x => x.inlineData || x.inline_data);
  const d = img && (img.inlineData || img.inline_data);
  if (!d) throw new ApiError(502, j.promptFeedback?.blockReason ? '안전 정책으로 생성이 거부되었습니다: ' + j.promptFeedback.blockReason : '이미지가 반환되지 않았습니다. 프롬프트를 바꿔 보세요.');
  return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
}

async function openaiImages(prompt, size, n) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: MODEL, prompt, size, n }),
  });
  const j = await r.json();
  if (!r.ok) throw new ApiError(r.status, j.error?.message || 'OpenAI 오류');
  return j.data.map(d => d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url);
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
  const ratio = RATIOS.includes(p.ratio) ? p.ratio : '1:1';
  const n = Math.min(Math.max(parseInt(p.n) || 1, 1), 2);   // 채널당 시안 최대 2개
  if (!prompt) return send(res, 400, { error: 'prompt가 비어 있습니다.' });

  try {
    const images = PROVIDER === 'gemini'
      ? await Promise.all(Array.from({ length: n }, () => geminiOne(prompt, ratio)))
      : await openaiImages(prompt, size, n);
    send(res, 200, { provider: PROVIDER, images });
  } catch (e) {
    send(res, e.status || 502, { error: String(e.message || e) });
  }
}).listen(PORT, () => console.log(`이미지 중계 서버: http://localhost:${PORT}/api/image (${PROVIDER}: ${PROVIDER === 'gemini' ? GEMINI_MODEL : MODEL})`));
