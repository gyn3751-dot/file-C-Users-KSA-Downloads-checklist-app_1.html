// AI 사무실 서버 - 의존성 없음 (Node.js만 필요). 모든 직원은 내 Claude Code(claude -p)로 일한다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const AGENTS = require('./agents');
const TEMPLATES = require('./templates');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4300);
const WORK_DIR = path.resolve(process.env.OFFICE_WORKDIR || path.join(ROOT, '..')); // 문서를 읽어올 폴더
const DATA = path.join(ROOT, 'data');
const DRAFTS = path.join(ROOT, 'drafts');
const TASKS_FILE = path.join(DATA, 'tasks.json');
const CONFIG_FILE = path.join(DATA, 'config.json');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(DRAFTS, { recursive: true });

const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const save = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2), 'utf8');
let tasks = load(TASKS_FILE, []);
let config = load(CONFIG_FILE, { dailyCallLimit: 30, dailyCostLimitUsd: 5 });
tasks.forEach(t => { if (t.status === 'running') { t.status = 'failed'; t.error = '서버 재시작으로 중단됨'; } });
const persist = () => save(TASKS_FILE, tasks);
const today = () => new Date().toISOString().slice(0, 10);

// ---------- 파일 읽기 (txt/md/csv/xlsx/docx/hwpx) ----------
function unzip(buf) {
  const out = {};
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return out;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(ds, ds + csize);
    out[name] = () => (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    p += 46 + nlen + elen + clen;
  }
  return out;
}
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
function xlsxText(z) {
  const shared = z['xl/sharedStrings.xml'] ? [...z['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''))) : [];
  const names = Object.keys(z).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  return names.map((n, i) => {
    const rows = [...z[n]().matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r =>
      [...r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => {
        const v = (c[2] || '').match(/<v>([\s\S]*?)<\/v>/), is = (c[2] || '').match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (/t="s"/.test(c[1]) && v) return shared[+v[1]] || '';
        return decode(v ? v[1] : is ? is[1] : '');
      }).join('\t'));
    return `## 시트${i + 1}\n` + rows.join('\n');
  }).join('\n\n');
}
function readFileText(abs) {
  const ext = path.extname(abs).toLowerCase();
  if (['.txt', '.md', '.csv', '.json'].includes(ext)) return fs.readFileSync(abs, 'utf8');
  const z = unzip(fs.readFileSync(abs));
  if (ext === '.xlsx') return xlsxText(z);
  if (ext === '.docx') return decode((z['word/document.xml'] ? z['word/document.xml']() : '').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''));
  if (ext === '.hwpx') return Object.keys(z).filter(n => /Contents\/section\d+\.xml/.test(n)).sort()
    .map(n => decode(z[n]().replace(/<\/hp:p>/g, '\n').replace(/<[^>]+>/g, ''))).join('\n');
  throw new Error(`지원하지 않는 형식: ${ext} (hwp는 hwpx나 docx로 저장해서 쓰세요)`);
}
const safePath = rel => {
  const abs = path.resolve(WORK_DIR, rel);
  if (!abs.startsWith(WORK_DIR + path.sep) || abs.startsWith(ROOT + path.sep)) throw new Error('허용되지 않은 경로');
  return abs;
};
function listFiles(dir = WORK_DIR, depth = 0, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (abs === ROOT || e.name.startsWith('.') || e.name === 'node_modules') continue;
    if (e.isDirectory() && depth < 2) listFiles(abs, depth + 1, out);
    else if (/\.(txt|md|csv|json|xlsx|docx|hwpx)$/i.test(e.name) && !e.name.startsWith('~$')) out.push(path.relative(WORK_DIR, abs));
  }
  return out;
}

// ---------- Claude Code 호출 ----------
function findClaude() {
  if (process.env.CLAUDE_CMD) return process.env.CLAUDE_CMD;
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.split(/\r?\n/)[0].trim();
  // Claude 데스크톱 앱에 포함된 Claude Code (PATH에 없음) - 가장 최신 버전을 사용
  const base = path.join(process.env.LOCALAPPDATA || '', 'Claude-Data');
  try {
    const found = [];
    for (const a of fs.readdirSync(base)) {
      const cc = path.join(base, a, 'claude-code');
      if (!fs.existsSync(cc)) continue;
      for (const v of fs.readdirSync(cc)) for (const h of fs.readdirSync(path.join(cc, v))) {
        const exe = path.join(cc, v, h, 'claude.exe');
        if (fs.existsSync(exe)) found.push({ v, exe });
      }
    }
    found.sort((x, y) => x.v.localeCompare(y.v, undefined, { numeric: true }));
    return found.length ? found[found.length - 1].exe : null;
  } catch { return null; }
}
function runClaude(prompt, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const cmd = findClaude();
    if (!cmd) return reject(new Error('claude 명령을 찾을 수 없어요. Claude Code 설치 후 터미널에서 claude 로 로그인하세요.'));
    const args = ['-p', '--output-format', 'json', ...extraArgs];
    const p = spawn(cmd, args, { cwd: ROOT, shell: /\.(cmd|bat)$/i.test(cmd), windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', reject);
    p.on('close', code => {
      try { resolve(JSON.parse(out)); }
      catch { code === 0 ? resolve({ result: out }) : reject(new Error((err || out || `종료 코드 ${code}`).slice(0, 500))); }
    });
    p.stdin.end(prompt);
  });
}
const usageToday = () => {
  const t = tasks.filter(x => x.finishedAt && x.finishedAt.startsWith(today()));
  return { calls: t.length, costUsd: +t.reduce((s, x) => s + (x.costUsd || 0), 0).toFixed(4) };
};

let seq = tasks.reduce((m, t) => Math.max(m, t.id), 0);
function newTask({ title, agent, instruction, files = [], parent, reviewOf }) {
  return { id: ++seq, title: title || instruction.slice(0, 30), agent, instruction, files, parent, reviewOf,
    status: 'pending', createdAt: new Date().toISOString() };
}

async function executeTask(t) {
  const agent = AGENTS[t.agent];
  const u = usageToday();
  if (u.calls >= config.dailyCallLimit || u.costUsd >= config.dailyCostLimitUsd) {
    t.status = 'failed'; t.error = '오늘 예산(호출/비용) 한도에 도달했어요. 크레딧 설정에서 조정하세요.'; return persist();
  }
  t.status = 'running'; t.startedAt = new Date().toISOString(); persist();
  try {
    let materials = '';
    for (const f of t.files || []) materials += `\n\n===== 첨부: ${f} =====\n${readFileText(safePath(f)).slice(0, 60000)}`;
    if (t.reviewOf) { // 검토 요청: 대상 업무의 지시와 결과물을 자료로 첨부
      const src = tasks.find(x => x.id === t.reviewOf);
      if (!src || !src.result) throw new Error('검토할 결과물을 찾을 수 없어요');
      materials += `\n\n===== 검토 대상: #${src.id} ${src.title} (담당: ${AGENTS[src.agent].name}) =====\n[원래 지시]\n${src.instruction}\n\n[결과물]\n${src.result.slice(0, 60000)}`;
    }
    const prompt = `${AGENTS._rules}${approvalRules(t.agent)}\n\n[당신의 역할]\n${agent.prompt}\n\n[지시]\n${t.instruction}${materials}`;
    const res = await runClaude(prompt, ['--allowedTools', 'Read,Glob,Grep', '--add-dir', WORK_DIR]);
    t.costUsd = res.total_cost_usd || 0;
    let text = res.result || '';
    if (t.agent === 'manager') {
      const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
      try {
        for (const s of JSON.parse(m[1])) if (AGENTS[s.agent] && s.agent !== 'manager')
          tasks.push(newTask({ title: s.title, agent: s.agent, instruction: s.instruction, files: s.files || [], parent: t.id }));
      } catch { text += '\n\n(하위 업무를 자동으로 분해하지 못했어요. 위 계획을 보고 직접 등록하세요.)'; }
    }
    const rel = path.join('drafts', `${t.id}.md`);
    fs.writeFileSync(path.join(ROOT, rel), `# ${t.title}\n담당: ${agent.name} · 초안 (검토 후 직접 사용하세요)\n\n${text}\n`, 'utf8');
    t.status = 'done'; t.resultFile = rel; t.result = text;
  } catch (e) { t.status = 'failed'; t.error = String(e.message || e); }
  t.finishedAt = new Date().toISOString(); persist();
}

// ---------- 위임전결규정 (결재 규칙) ----------
// 문서 폴더의 '위임전결' 엑셀을 찾아 직원 프롬프트에 참고자료로 넣는다. 파일이 바뀌면 다음 작업부터 자동 반영.
const APPROVAL_AGENTS = ['manager', 'document', 'mail', 'civil', 'reviewer'];
const APPROVAL_MAX = 40000;
function approvalRules(agentId) {
  if (!APPROVAL_AGENTS.includes(agentId)) return '';
  try {
    const rel = listFiles().find(f => /위임전결/.test(f) && /\.xlsx$/i.test(f));
    if (!rel) return '';
    const txt = readFileText(safePath(rel)).replace(/[\t ]+(?=\n|$)/g, '').replace(/\n{2,}/g, '\n').slice(0, APPROVAL_MAX);
    return `\n\n[위임전결규정 - 결재 규칙]\n아래는 우리 조직의 위임전결 규정(${path.basename(rel)})이다. 표의 ●/○ 표시가 있는 열이 해당 업무의 전결권자/결재 단계다.\n` +
      `- 업무 성격에 맞는 단위업무를 찾아 결과물 맨 끝에 "## 결재 안내" 섹션을 붙여라: 해당 규정 항목, 전결권자, 협의/합의·수신처, 근거 문구.\n` +
      `- 규정에서 해당 항목을 확실히 찾지 못하면 추측하지 말고 "전결 항목 확인 필요"라고 쓰고 후보 항목을 제시하라.\n` +
      `- 이는 안내일 뿐이며 결재 상신은 사용자가 직접 한다.\n\n${txt}`;
  } catch { return ''; }
}
// ---------- 노션 칸반 동기화 (사용자가 버튼을 눌렀을 때만, Claude의 Notion 커넥터 사용) ----------
async function syncNotion(boardUrl) {
  const lines = tasks.map(t => `- [${t.status}] #${t.id} ${t.title} (담당: ${AGENTS[t.agent] ? AGENTS[t.agent].name : t.agent}) ${t.resultFile || ''}`).join('\n');
  const prompt = `내 노션 칸반 보드(${boardUrl || '업무 보드 데이터베이스를 검색해서 사용'})를 아래 업무 목록과 맞춰 줘. ` +
    `상태 매핑: pending=결재대기, running=진행중, done=완료, failed/rejected=반려. 이미 있는 카드는 상태만 갱신하고 중복 생성하지 마. 삭제는 하지 마.\n${lines}`;
  const res = await runClaude(prompt, ['--allowedTools', 'mcp__notion']);
  return res.result;
}

// ---------- HTTP ----------
const send = (res, code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = req => new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'index.html')), 'text/html; charset=utf-8');
    if (p === '/api/state') return send(res, 200, {
      agents: Object.entries(AGENTS).filter(([k]) => k[0] !== '_').map(([id, a]) => ({ id, name: a.name, title: a.title, emoji: a.emoji, does: a.does })),
      templates: TEMPLATES, tasks, usage: usageToday(), config, workDir: WORK_DIR, claudeFound: !!findClaude() });
    if (p === '/api/files') return send(res, 200, listFiles());
    if (p === '/api/preview') return send(res, 200, { text: readFileText(safePath(url.searchParams.get('f'))).slice(0, 3000) });
    if (req.method === 'POST' && p === '/api/tasks') {
      const b = await readBody(req);
      if (!AGENTS[b.agent] || b.agent[0] === '_' || !b.instruction) return send(res, 400, { error: '담당자와 지시를 입력하세요' });
      (b.files || []).forEach(safePath);
      if (b.reviewOf) { const src = tasks.find(x => x.id === +b.reviewOf); if (!src || src.status !== 'done') return send(res, 400, { error: '완료된 업무만 검토 요청할 수 있어요' }); b.reviewOf = src.id; }
      const t = newTask(b); tasks.push(t); persist(); return send(res, 200, t);
    }
    const m = p.match(/^\/api\/tasks\/(\d+)\/(approve|reject)$/);
    if (req.method === 'POST' && m) {
      const t = tasks.find(x => x.id === +m[1]);
      if (!t) return send(res, 404, { error: 'not found' });
      if (m[2] === 'reject') { t.status = 'rejected'; persist(); return send(res, 200, t); }
      if (!['pending', 'failed'].includes(t.status)) return send(res, 400, { error: '승인할 수 없는 상태' });
      t.error = undefined; executeTask(t); return send(res, 200, t); // 백그라운드 실행
    }
    if (req.method === 'POST' && p === '/api/config') {
      const b = await readBody(req);
      config = { dailyCallLimit: +b.dailyCallLimit || config.dailyCallLimit, dailyCostLimitUsd: +b.dailyCostLimitUsd || config.dailyCostLimitUsd };
      save(CONFIG_FILE, config); return send(res, 200, config);
    }
    if (req.method === 'POST' && p === '/api/notion-sync') { const b = await readBody(req); return send(res, 200, { result: await syncNotion(b.boardUrl) }); }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => console.log(`AI 사무실: http://localhost:${PORT}  (문서 폴더: ${WORK_DIR})`));