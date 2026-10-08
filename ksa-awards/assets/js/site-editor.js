/* 사이트 편집 패널
 * - claude.ai 미리보기: 편집 권한(Editor/Owner)이 있으면 패널이 보이고, 저장 시 db 문서 site/config 에 기록되어 모든 방문자에게 반영됩니다.
 * - 일반 웹 서버: 주소 끝에 #edit 를 붙이면 패널이 열립니다. 저장은 이 브라우저(localStorage)에만 되며,
 *   "설정 복사"로 받은 JSON 을 전달하면 사이트 기본값으로 반영할 수 있습니다.
 */
(function(){
  'use strict';
  const LS_KEY='ksa-site-config',LS_EDIT='ksa-site-edit';
  const $=s=>document.querySelector(s);
  const IDX=window.KSA_INDICES||[];
  const SLOGANS=[
    ['1위는 소비자가 정합니다.','소비자 만족 1위, 국가 표준이 증명합니다.','1위'],
    ['소비자가 직접 뽑은 1위,','그 이름을 표준이 증명합니다.','1위'],
    ['만족의 정점,','소비자가 선택한 1위.','1위'],
    ['소비자 만족 1위,','국가 표준으로 증명된 이름.','표준'],
    ['고객이 고른 1위,','표준이 확인한 1위.','1위'],
    ['고객이 증명한 품질,','국가 표준의 이름으로 인정받습니다.','표준']
  ];

  /* ── defaults come from the page as written ── */
  const root=document.documentElement,css=getComputedStyle(root);
  const DEF_BRASS=css.getPropertyValue('--brass').trim();
  const h1=$('.hero h1'),eyebrow=$('.hero-head .eyebrow'),lede=$('.hero-lede');
  const cta1=$('.hero-cta .btn:not(.ghost)'),cta2=$('.hero-cta .btn.ghost');
  if(!h1)return;
  const [l1,l2]=h1.innerHTML.split(/<br\s*\/?>/i).map(t=>t.replace(/<[^>]+>/g,'').trim());
  const label=a=>a?a.firstChild.textContent.trim():'';
  const DEFAULTS={
    eyebrow:eyebrow?eyebrow.textContent.trim():'',
    title1:l1||'',title2:l2||'',highlight:(h1.querySelector('em')||{}).textContent||'',
    lede:lede?lede.textContent.trim():'',
    cta1:label(cta1),cta2:label(cta2),
    accent:'',navy:'',
    autoRotate:true,showProcess:true,showSchedule:true,
    homepages:Object.fromEntries(IDX.map(x=>[x.id,x.homepage]))
  };
  let saved=null,cfg=clone(DEFAULTS),backend='none',db=null,docRef=null;

  function clone(o){return JSON.parse(JSON.stringify(o))}
  function merge(base,over){const out=clone(base);if(!over||typeof over!=='object')return out;
    for(const k of Object.keys(base)){if(!(k in over))continue;
      if(k==='homepages'){for(const id of Object.keys(base.homepages)){const v=over.homepages&&over.homepages[id];if(typeof v==='string'&&/^https?:\/\//.test(v))out.homepages[id]=v}}
      else if(typeof base[k]===typeof over[k])out[k]=over[k]}
    return out}
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const hex=v=>/^#[0-9a-f]{6}$/i.test(v)?v:'';

  /* ── apply a config to the page ── */
  function apply(c){
    if(eyebrow)eyebrow.textContent=c.eyebrow;
    const hl=c.highlight.trim(),mark=t=>{const e=esc(t);if(!hl)return e;const i=e.indexOf(esc(hl));return i<0?e:e.slice(0,i)+'<em>'+esc(hl)+'</em>'+e.slice(i+esc(hl).length)};
    let done=false;const line=t=>{if(done||!hl||!t.includes(hl))return esc(t);done=true;return mark(t)};
    h1.innerHTML=line(c.title1)+(c.title2?'<br>'+line(c.title2):'');
    if(lede)lede.textContent=c.lede;
    if(cta1)cta1.firstChild.textContent=c.cta1+' ';
    if(cta2)cta2.firstChild.textContent=c.cta2+' ';
    if(hex(c.accent))root.style.setProperty('--brass',hex(c.accent));else root.style.removeProperty('--brass');
    if(hex(c.navy))root.style.setProperty('--navy',hex(c.navy));else root.style.removeProperty('--navy');
    const p=$('#process'),s=$('#schedule');if(p)p.hidden=!c.showProcess;if(s)s.hidden=!c.showSchedule;
    document.querySelectorAll('#nav a[href="#process"],footer a[href="#process"]').forEach(a=>a.closest('li,a').hidden=!c.showProcess);
    document.querySelectorAll('#nav a[href="#schedule"],footer a[href="#schedule"]').forEach(a=>a.closest('li,a').hidden=!c.showSchedule);
    IDX.forEach(x=>{if(c.homepages[x.id])x.homepage=c.homepages[x.id]});
    window.KSA_SITE={autoRotate:c.autoRotate};
    const k=window.__ksa;if(k&&k.show&&k.current)k.show(k.current());
  }

  /* ── panel ── */
  const fab=document.createElement('button');fab.type='button';fab.className='se-fab';fab.hidden=true;
  fab.innerHTML='<span aria-hidden="true">✎</span> 사이트 편집';fab.setAttribute('aria-controls','sePanel');
  const panel=document.createElement('aside');panel.className='se-panel';panel.id='sePanel';panel.setAttribute('aria-label','사이트 편집');panel.hidden=true;
  panel.innerHTML=`
    <header class="se-head"><div><b>사이트 편집</b><span id="seMode"></span></div><button type="button" class="se-x" id="seClose" aria-label="닫기">✕</button></header>
    <div class="se-body">
      <section class="se-ai" id="seAI" hidden><h3>Claude에게 요청 <small>바꾸고 싶은 내용을 문장으로 적어 주세요</small></h3>
        <textarea id="se-ask" rows="3" aria-label="Claude에게 요청할 내용" placeholder="예: 제목을 소비자 만족 1위를 강조하는 문구로 바꾸고 포인트 색은 블루로 해줘"></textarea>
        <button type="button" class="se-btn" id="seAsk">Claude에게 적용 요청</button>
        <p class="se-ai-note" id="seAiNote" aria-live="polite"></p>
      </section>
      <section><h3>메인 문구</h3>
        <label for="se-eyebrow">영문 소제목</label><input id="se-eyebrow" data-k="eyebrow">
        <label for="se-title1">제목 첫째 줄</label><input id="se-title1" data-k="title1">
        <label for="se-title2">제목 둘째 줄</label><input id="se-title2" data-k="title2">
        <label for="se-highlight">금색 강조 단어 <small>제목 안에 있는 단어</small></label><input id="se-highlight" data-k="highlight">
        <label for="se-lede">소개 문구</label><textarea id="se-lede" data-k="lede" rows="3"></textarea>
        <div class="se-2"><div><label for="se-cta1">첫째 버튼</label><input id="se-cta1" data-k="cta1"></div><div><label for="se-cta2">둘째 버튼</label><input id="se-cta2" data-k="cta2"></div></div>
      </section>
      <section><h3>슬로건 추천 <small>누르면 제목에 바로 들어갑니다</small></h3><div class="se-slogans" id="seSlogans"></div></section>
      <section><h3>색상</h3>
        <div class="se-2"><div><label for="se-accent">포인트 색</label><input type="color" id="se-accent" data-k="accent"></div><div><label for="se-navy">보드 남색</label><input type="color" id="se-navy" data-k="navy"></div></div>
        <div class="se-swatches" id="seSwatches"></div>
      </section>
      <section><h3>표시 설정</h3>
        <label class="se-check"><input type="checkbox" id="se-autoRotate" data-k="autoRotate"> 행성 자동 회전</label>
        <label class="se-check"><input type="checkbox" id="se-showProcess" data-k="showProcess"> 참여 절차 섹션 보이기</label>
        <label class="se-check"><input type="checkbox" id="se-showSchedule" data-k="showSchedule"> 연간 일정 섹션 보이기</label>
      </section>
      <section><h3>지수별 공식 홈페이지</h3><div id="seHomes"></div></section>
    </div>
    <footer class="se-foot">
      <p class="se-status" id="seStatus" role="status"></p>
      <div class="se-2"><button type="button" class="se-btn ghost" id="seReset">기본값으로</button><button type="button" class="se-btn" id="seSave">저장</button></div>
      <button type="button" class="se-link" id="seCopy">설정 복사 (JSON)</button>
    </footer>`;
  document.body.append(fab,panel);
  const status=$('#seStatus');
  $('#seHomes').innerHTML=IDX.map(x=>`<label for="se-home-${x.id}">${esc(x.code)} <small>${esc(x.name)}</small></label><input id="se-home-${x.id}" type="url" inputmode="url" data-home="${x.id}" placeholder="https://">`).join('');
  $('#seSlogans').innerHTML=SLOGANS.map((s,i)=>`<button type="button" data-s="${i}"><b>${esc(s[0])}</b> ${esc(s[1])}</button>`).join('');
  const SW=[['기본',''],['골드','#9C7A3C'],['로열 블루','#2F5BD3'],['코랄','#D9573B'],['에메랄드','#2E8B6A']];
  $('#seSwatches').innerHTML=SW.map(([n,v])=>`<button type="button" data-sw="${v}" style="--sw:${v||DEF_BRASS}"><i></i>${n}</button>`).join('');

  function fill(){
    panel.querySelectorAll('[data-k]').forEach(el=>{const v=cfg[el.dataset.k];
      if(el.type==='checkbox')el.checked=!!v;else if(el.type==='color')el.value=hex(v)||(el.dataset.k==='accent'?toHex(css.getPropertyValue('--brass')):toHex(css.getPropertyValue('--navy')));else el.value=v});
    panel.querySelectorAll('[data-home]').forEach(el=>el.value=cfg.homepages[el.dataset.home]||'');
  }
  function toHex(v){v=v.trim();if(hex(v))return v;const m=v.match(/\d+/g);return m?'#'+m.slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join(''):'#000000'}
  let dirty=false;
  function changed(){dirty=JSON.stringify(cfg)!==JSON.stringify(saved||DEFAULTS);apply(cfg);setStatus(dirty?'저장하지 않은 변경 사항이 있습니다.':'')}
  function setStatus(t,kind){status.textContent=t;status.dataset.kind=kind||''}
  panel.addEventListener('input',e=>{const el=e.target;
    if(el.dataset.k){cfg[el.dataset.k]=el.type==='checkbox'?el.checked:el.value;changed()}
    else if(el.dataset.home){if(!el.value||/^https?:\/\//.test(el.value)){cfg.homepages[el.dataset.home]=el.value||DEFAULTS.homepages[el.dataset.home];el.removeAttribute('aria-invalid');changed()}else el.setAttribute('aria-invalid','true')}});
  panel.addEventListener('change',e=>{if(e.target.type==='checkbox'){cfg[e.target.dataset.k]=e.target.checked;changed()}});
  $('#seSlogans').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b)return;const s=SLOGANS[+b.dataset.s];cfg.title1=s[0];cfg.title2=s[1];cfg.highlight=s[2];fill();changed()});
  $('#seSwatches').addEventListener('click',e=>{const b=e.target.closest('[data-sw]');if(!b)return;cfg.accent=b.dataset.sw;fill();changed()});
  $('#seReset').onclick=()=>{cfg=clone(DEFAULTS);fill();changed();setStatus('기본값을 불러왔습니다. 저장하면 반영됩니다.')};
  $('#seCopy').onclick=async()=>{const t=JSON.stringify(cfg,null,2);try{await navigator.clipboard.writeText(t);setStatus('설정을 복사했습니다.','ok')}catch(_){let ta=$('#seJson');if(!ta){ta=document.createElement('textarea');ta.id='seJson';ta.rows=6;ta.readOnly=true;ta.setAttribute('aria-label','설정 JSON');$('.se-foot').appendChild(ta)}ta.value=t;ta.focus();ta.select();setStatus('자동 복사가 막혀 있어 아래 칸의 내용을 직접 복사해 주세요.')}};
  $('#seSave').onclick=save;
  $('#seClose').onclick=close;
  fab.onclick=()=>panel.hidden?open():close();
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
  function open(){panel.hidden=false;fill();document.body.classList.add('se-open');$('#se-title1').focus({preventScroll:true})}
  function close(){panel.hidden=true;document.body.classList.remove('se-open')}

  async function save(){
    const btn=$('#seSave');btn.disabled=true;setStatus('저장 중…');
    try{
      if(backend==='db'){await docRef.set(clone(cfg));setStatus('저장했습니다. 이 페이지를 보는 모든 사람에게 반영됩니다.','ok')}
      else{try{localStorage.setItem(LS_KEY,JSON.stringify(cfg))}catch(_){throw new Error('local')}setStatus('이 브라우저에 저장했습니다. 사이트 전체에 반영하려면 "설정 복사"로 받은 내용을 전달해 주세요.','ok')}
      saved=clone(cfg);dirty=false;
    }catch(e){
      if(e&&e.code==='invalid_argument')setStatus('저장 권한이 없습니다. 편집 권한이 있는 계정으로 열어 주세요.','err');
      else if(e&&e.message==='local')setStatus('이 브라우저에서는 저장소를 쓸 수 없습니다. "설정 복사"를 이용해 주세요.','err');
      else setStatus('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.','err');
    }finally{btn.disabled=false}
  }

  /* ── Claude request: turn a sentence into a settings patch, preview it, let the editor save ── */
  let sample=null,askCtl=null;
  async function ask(){
    const q=$('#se-ask').value.trim(),note=$('#seAiNote'),btn=$('#seAsk');
    if(!q){note.textContent='요청할 내용을 적어 주세요.';return}
    if(askCtl)askCtl.abort();askCtl=new AbortController();
    btn.disabled=true;note.textContent='Claude가 설정을 고치는 중입니다…';
    const prompt=`당신은 한국표준협회 지수 소개 웹사이트의 설정을 고치는 편집 도우미입니다.
현재 설정(JSON):
${JSON.stringify(cfg)}

필드 설명:
- eyebrow: 제목 위 영문 소제목 (짧은 영어)
- title1, title2: 메인 제목 첫째·둘째 줄 (한국어, 각 줄 20자 안팎)
- highlight: 금색으로 강조할 단어. 반드시 title1 또는 title2 안에 그대로 들어 있는 단어
- lede: 제목 아래 소개 문구 (한국어 1~2문장)
- cta1, cta2: 버튼 두 개의 글자 (짧게)
- accent: 포인트 색 "#rrggbb" ("" = 기본 금색), navy: 보드 배경 남색 "#rrggbb" ("" = 기본)
- autoRotate: 행성 자동 회전, showProcess: 참여 절차 섹션 표시, showSchedule: 연간 일정 섹션 표시 (true/false)
- homepages: {qei, cqi, pbi, well, dcxi} 각 지수 공식 홈페이지 https 주소

사용자 요청: ${q}

규칙: 요청과 관련된 필드만 바꾸세요. 사용자가 주지 않은 홈페이지 주소는 만들지 마세요. 문구는 간결하고 격식 있게 쓰세요. 이 필드들로 할 수 없는 요청이면 patch를 비우고 note에 이유를 쓰세요.
JSON 하나만 답하세요: {"patch": {바꿀 필드만}, "note": "무엇을 바꿨는지 한국어 한 문장"}`;
    try{
      const r=await sample.json(prompt,{signal:askCtl.signal});
      const patch=r&&typeof r.patch==='object'&&r.patch?r.patch:{};
      const next=Object.assign(clone(cfg),patch,{homepages:Object.assign(clone(cfg.homepages),patch.homepages||{})});
      cfg=merge(DEFAULTS,next);fill();changed();
      const n=Object.keys(patch).length;
      note.textContent=(r&&r.note?String(r.note):'')+(n?' 마음에 들면 저장을 눌러 주세요.':'');
    }catch(e){
      const code=e&&e.code;
      if(code==='cancelled')return;
      if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(code)){$('#seAI').hidden=true;return}
      note.textContent=code==='rate_limited'?'요청이 많아 잠시 후 다시 시도해 주세요.':code==='invalid_json'?'답을 해석하지 못했습니다. 요청을 조금 더 구체적으로 적어 주세요.':'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }finally{btn.disabled=false}
  }
  $('#seAsk').onclick=ask;
  $('#se-ask').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();ask()}});

  /* ── boot: local first, then the shared store when the viewer provides it ── */
  try{const raw=localStorage.getItem(LS_KEY);if(raw){saved=merge(DEFAULTS,JSON.parse(raw));cfg=clone(saved);apply(cfg)}}catch(_){}
  const wantsEdit=()=>{try{if(location.hash==='#edit')localStorage.setItem(LS_EDIT,'1');return location.hash==='#edit'||localStorage.getItem(LS_EDIT)==='1'}catch(_){return location.hash==='#edit'}};
  function showLocal(){backend='local';$('#seMode').textContent='이 브라우저에만 저장';fab.hidden=!wantsEdit()}
  addEventListener('hashchange',()=>{if(backend!=='db'&&wantsEdit()){fab.hidden=false;open()}});

  const C=window.claude;
  if(!C||!C.use){showLocal();return}
  C.use('sample').then(fn=>{if(typeof fn==='function'){sample=fn;$('#seAI').hidden=false}}).catch(()=>{});
  Promise.all([C.use('db'),C.use('user')]).then(async([d,u])=>{
    if(!d){showLocal();return}
    db=d;docRef=db.doc('site/config');
    let first=true;
    docRef.onSnapshot(snap=>{
      if(snap.exists){saved=merge(DEFAULTS,snap.data());if(!dirty){cfg=clone(saved);apply(cfg);if(!panel.hidden)fill()}}
      else if(first&&!saved){saved=clone(DEFAULTS)}
      first=false;
    },()=>{});
    const canEdit=u?(await u.canEdit().catch(()=>false))||(await u.isOwner().catch(()=>false)):false;
    backend='db';$('#seMode').textContent=canEdit?'저장 시 모든 방문자에게 반영':'보기 전용';
    fab.hidden=!canEdit;$('#seSave').hidden=!canEdit;
  }).catch(showLocal);
})();
