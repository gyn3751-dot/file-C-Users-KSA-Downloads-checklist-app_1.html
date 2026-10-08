/* 사이트 편집 패널
 * - claude.ai 미리보기: 편집 권한(Editor/Owner)이 있으면 패널이 보이고, 저장 시 db 문서 site/config 에 기록되어 모든 방문자에게 반영됩니다.
 * - 일반 웹 서버: 주소 끝에 #edit 를 붙이면 패널이 열립니다. 저장은 이 브라우저(localStorage)에만 되며,
 *   "설정 복사"로 받은 JSON 을 전달하면 사이트 기본값으로 반영할 수 있습니다.
 */
(function(){
  'use strict';
  const LS_KEY='ksa-site-config',LS_EDIT='ksa-site-edit';
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const IDX=window.KSA_INDICES||[];
  const SLOGANS=[
    ['1위는 소비자가 정합니다.','소비자 만족 1위, 국가 표준이 증명합니다.','1위'],
    ['소비자가 직접 뽑은 1위,','그 이름을 표준이 증명합니다.','1위'],
    ['만족의 정점,','소비자가 선택한 1위.','1위'],
    ['소비자 만족 1위,','국가 표준으로 증명된 이름.','표준'],
    ['고객이 고른 1위,','표준이 확인한 1위.','1위'],
    ['고객이 증명한 품질,','국가 표준의 이름으로 인정받습니다.','표준']
  ];
  const INDEX_FIELDS=[['name','지수 이름'],['en','영문 이름'],['desc','설명','area'],['target','평가 대상'],['method','평가 방식'],['announce','결과 발표 (예: 10월)']];
  const SECTIONS=[['indices','지수 소개'],['process','참여 절차'],['schedule','연간 일정']];
  const PHASES=[['apply','조사 부문 설정'],['survey','조사 · 평가'],['notice','조사결과 안내'],['award','발표 · 인증식']];
  const SC=window.KSA_SITE_CONFIG||{logoUrl:()=>'',DEFAULT_LOGO:{}};
  const K0=window.__ksa||{};
  const ST=K0.schedTools||{normRange:r=>r,year:2026};

  /* ── defaults come from the page as written ── */
  const root=document.documentElement,css=getComputedStyle(root);
  const DEF_BRASS=css.getPropertyValue('--brass').trim();
  const h1=$('.hero h1'),eyebrow=$('.hero-head .eyebrow'),lede=$('.hero-lede');
  const cta1=$('.hero-cta .btn:not(.ghost)'),cta2=$('.hero-cta .btn.ghost');
  if(!h1)return;
  const text=el=>el?el.textContent.trim():'';
  const multi=el=>el?el.innerHTML.split(/<br\s*\/?>/i).map(t=>t.replace(/<[^>]+>/g,'').trim()).join('\n'):'';
  const [l1,l2]=multi(h1).split('\n');
  const label=a=>a?a.firstChild.textContent.trim():'';
  const secEls=id=>({h:$(`#${id} .sec-head h2`),p:$(`#${id} .sec-head p:not(.eyebrow)`)});
  const stepEls=()=>$$('#process .steps li');
  const DEFAULTS={
    eyebrow:text(eyebrow),
    title1:l1||'',title2:l2||'',highlight:text(h1.querySelector('em')),
    lede:text(lede),cta1:label(cta1),cta2:label(cta2),
    accent:'',navy:'',
    autoRotate:true,showProcess:true,showSchedule:true,
    planetClick:'homepage',
    sections:Object.fromEntries(SECTIONS.map(([id])=>{const e=secEls(id);return[id,{title:multi(e.h),desc:text(e.p)}]})),
    steps:stepEls().map(li=>({t:text(li.querySelector('h3')),p:text(li.querySelector('p'))})),
    indices:Object.fromEntries(IDX.map(x=>[x.id,Object.assign(Object.fromEntries(INDEX_FIELDS.map(([k])=>[k,x[k]||''])),{dims:x.dims.map(d=>[d[0],d[1]])})])),
    schedule:JSON.parse(JSON.stringify(K0.schedule||{})),
    logos:Object.fromEntries(IDX.map(x=>[x.id,''])),
    homepages:Object.fromEntries(IDX.map(x=>[x.id,x.homepage]))
  };
  let saved=null,cfg=clone(DEFAULTS),backend='none',db=null,docRef=null;

  function clone(o){return JSON.parse(JSON.stringify(o))}
  /* keep only the shape of DEFAULTS: unknown keys dropped, wrong types fall back */
  function merge(base,over){
    if(Array.isArray(base))return base.map((b,i)=>Array.isArray(over)&&i<over.length?merge(b,over[i]):clone(b));
    if(base&&typeof base==='object'){const o={};for(const k of Object.keys(base))o[k]=over&&typeof over==='object'&&!Array.isArray(over)&&k in over?merge(base[k],over[k]):clone(base[k]);return o}
    return typeof over===typeof base?over:base;
  }
  const okUrl=v=>/^https?:\/\/[^\s]+$/.test(v);
  /* settings saved before exact dates stored months as numbers; turn them into dates before the shape check */
  function upgrade(o){
    /* the process gained a 5th step (조사결과 안내); a saved 6-step list keeps its texts in the right places */
    if(o&&Array.isArray(o.steps)&&o.steps.length===6&&DEFAULTS.steps.length===7)o.steps.splice(4,0,clone(DEFAULTS.steps[4]));
    if(o&&o.schedule&&typeof o.schedule==='object')for(const id of Object.keys(o.schedule))for(const ph of Object.keys(o.schedule[id]||{})){const r=ST.normRange(o.schedule[id][ph]);if(r)o.schedule[id][ph]=r}return o}
  function sanitize(c){
    for(const id of Object.keys(c.homepages))if(!okUrl(c.homepages[id]))c.homepages[id]=DEFAULTS.homepages[id];
    if(!['homepage','detail','flip'].includes(c.planetClick))c.planetClick='homepage';
    for(const id of Object.keys(c.logos))if(c.logos[id]&&!SC.logoUrl(c.logos[id]))c.logos[id]='';
    for(const id of Object.keys(c.indices))c.indices[id].dims.forEach(d=>{d[1]=Math.max(0,Math.min(100,Math.round(+d[1]||0)))});
    for(const id of Object.keys(c.schedule))for(const [ph] of PHASES){const r=ST.normRange(c.schedule[id][ph]);c.schedule[id][ph]=r||clone(DEFAULTS.schedule[id][ph])}
    return c;
  }
  function deepAssign(t,s){if(!s||typeof s!=='object')return t;for(const k of Object.keys(s)){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])&&t[k]&&typeof t[k]==='object'&&!Array.isArray(t[k]))deepAssign(t[k],s[k]);else t[k]=s[k]}return t}
  const getPath=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
  const setPath=(o,p,v)=>{const ks=p.split('.'),last=ks.pop();ks.reduce((a,k)=>a[k],o)[last]=v};
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const hex=v=>/^#[0-9a-f]{6}$/i.test(v)?v:'';

  /* ── apply a config to the page ── */
  function apply(c){
    if(eyebrow)eyebrow.textContent=c.eyebrow;
    const hl=c.highlight.trim();let done=false;
    const line=t=>{const e=esc(t);if(done||!hl||!t.includes(hl))return e;done=true;const i=e.indexOf(esc(hl));return e.slice(0,i)+'<em>'+esc(hl)+'</em>'+e.slice(i+esc(hl).length)};
    h1.innerHTML=line(c.title1)+(c.title2?'<br>'+line(c.title2):'');
    if(lede)lede.textContent=c.lede;
    if(cta1)cta1.firstChild.textContent=c.cta1+' ';
    if(cta2)cta2.firstChild.textContent=c.cta2+' ';
    if(hex(c.accent))root.style.setProperty('--brass',hex(c.accent));else root.style.removeProperty('--brass');
    if(hex(c.navy))root.style.setProperty('--navy',hex(c.navy));else root.style.removeProperty('--navy');
    for(const [id] of SECTIONS){const e=secEls(id),v=c.sections[id];if(e.h)e.h.innerHTML=esc(v.title).replace(/\n/g,'<br>');if(e.p)e.p.textContent=v.desc}
    stepEls().forEach((li,i)=>{const v=c.steps[i];if(!v)return;li.querySelector('h3').textContent=v.t;li.querySelector('p').textContent=v.p});
    const p=$('#process'),s=$('#schedule');if(p)p.hidden=!c.showProcess;if(s)s.hidden=!c.showSchedule;
    $$('#nav a[href="#process"],footer a[href="#process"]').forEach(a=>a.closest('li,a').hidden=!c.showProcess);
    $$('#nav a[href="#schedule"],footer a[href="#schedule"]').forEach(a=>a.closest('li,a').hidden=!c.showSchedule);
    IDX.forEach(x=>{const o=c.indices[x.id]||{};INDEX_FIELDS.forEach(([f])=>{x[f]=o[f]});x.dims=(o.dims||x.dims).map(d=>[d[0],d[1]]);
      if(c.homepages[x.id])x.homepage=c.homepages[x.id];
      const u=SC.logoUrl(c.logos[x.id]);x.logo=u||SC.DEFAULT_LOGO[x.id]||x.logo;x.logoCustom=!!u;
      $$(`.orb-plaque[data-idx="${x.id}"] img`).forEach(im=>{if(im.getAttribute('src')!==x.logo)im.src=x.logo})});
    if(K0.schedule)for(const id of Object.keys(c.schedule))if(K0.schedule[id])for(const [ph] of PHASES)K0.schedule[id][ph]=c.schedule[id][ph].slice();
    window.KSA_SITE={autoRotate:c.autoRotate,planetClick:c.planetClick};
    const k=window.__ksa;if(k&&k.rerender)k.rerender();
  }

  /* ── panel ── */
  const fab=document.createElement('button');fab.type='button';fab.className='se-fab';fab.hidden=true;
  fab.innerHTML='<span aria-hidden="true">✎</span> 사이트 편집';fab.setAttribute('aria-controls','sePanel');
  const panel=document.createElement('aside');panel.className='se-panel';panel.id='sePanel';panel.setAttribute('aria-label','사이트 편집');panel.hidden=true;
  /* half-month steps: 3 = 3월 초, 3.5 = 3월 중순, 13 = 12월 말 */
  const monthLabel=v=>v===13?'12월 말':`${Math.floor(v)}월 ${v%1?'중순':'초'}`;
  const monthOpts=(a,b)=>{let o='';for(let v=a;v<=b;v+=.5)o+=`<option value="${v}">${monthLabel(v)}</option>`;return o};
  const inp=(k,lab,opt={})=>`<label for="se-${k}">${lab}${opt.hint?` <small>${opt.hint}</small>`:''}</label>`+(opt.area?`<textarea id="se-${k}" data-k="${k}" rows="${opt.rows||3}"></textarea>`:`<input id="se-${k}" data-k="${k}"${opt.type?` type="${opt.type}" inputmode="url" placeholder="https://"`:''}>`);
  panel.innerHTML=`
    <header class="se-head"><div><b>사이트 편집</b><span id="seMode"></span></div><button type="button" class="se-x" id="seClose" aria-label="닫기">✕</button></header>
    <div class="se-body">
      <section class="se-ai" id="seAI" hidden><h3>Claude에게 요청 <small>바꾸고 싶은 내용을 문장으로 적어 주세요</small></h3>
        <textarea id="se-ask" rows="3" aria-label="Claude에게 요청할 내용" placeholder="예: KS-CQI 설명을 더 짧게 줄이고, 로고를 누르면 평가 기준이 보이게 해줘"></textarea>
        <button type="button" class="se-btn" id="seAsk">Claude에게 적용 요청</button>
        <p class="se-ai-note" id="seAiNote" aria-live="polite"></p>
      </section>
      <details open><summary>메인 문구</summary><div class="se-fields">
        ${inp('eyebrow','영문 소제목')}${inp('title1','제목 첫째 줄')}${inp('title2','제목 둘째 줄')}
        ${inp('highlight','금색 강조 단어',{hint:'제목 안에 있는 단어'})}${inp('lede','소개 문구',{area:1})}
        <div class="se-2"><div>${inp('cta1','첫째 버튼')}</div><div>${inp('cta2','둘째 버튼')}</div></div>
      </div></details>
      <details><summary>슬로건 추천</summary><div class="se-fields"><p class="se-help">누르면 제목에 바로 들어갑니다.</p><div class="se-slogans" id="seSlogans"></div></div></details>
      <details open><summary>행성 로고 · 지수별 사이트</summary><div class="se-fields">
        <p class="se-help">메인 보드의 행성(로고)을 눌렀을 때</p>
        <div class="se-radios" role="radiogroup" aria-label="행성 로고 클릭 동작">
          <label><input type="radio" name="se-pc" value="homepage"> 지수 공식 사이트로 이동 (새 탭)</label>
          <label><input type="radio" name="se-pc" value="detail"> 아래 지수 소개(평가 기준)로 이동</label>
          <label><input type="radio" name="se-pc" value="flip"> 메달 뒤집기만</label>
        </div>
        <p class="se-help">연결할 공식 사이트 주소</p>
        ${IDX.map(x=>inp(`homepages.${x.id}`,esc(x.code),{type:'url',hint:esc(x.name)})).join('')}
      </div></details>
      <details><summary>지수별 내용</summary><div class="se-fields">
        ${IDX.map(x=>`<details class="se-sub"><summary><i style="background:${x.color}"></i>${esc(x.code)}</summary><div class="se-fields">
          <p class="se-help strong">로고 이미지</p>
          <div class="se-logo"><span class="se-logo-prev"><img id="se-logo-${x.id}" alt="${esc(x.code)} 현재 로고"></span>
            <div><label class="se-btn ghost se-file" for="se-file-${x.id}">이미지 바꾸기</label><input type="file" id="se-file-${x.id}" accept="image/png,image/jpeg,image/webp,image/gif" data-logo="${x.id}" hidden>
            <button type="button" class="se-link" data-logo-reset="${x.id}">기본 로고로</button></div></div>
          ${INDEX_FIELDS.map(([f,l,a])=>inp(`indices.${x.id}.${f}`,l,{area:!!a,rows:4})).join('')}
          <p class="se-help strong">측정 항목 · 가중치 <small class="se-sum" data-sum="${x.id}"></small></p>
          ${x.dims.map((_,j)=>`<div class="se-dim"><input aria-label="${esc(x.code)} 측정 항목 ${j+1}" data-k="indices.${x.id}.dims.${j}.0"><input type="number" min="0" max="100" step="1" aria-label="${esc(x.code)} 항목 ${j+1} 가중치" data-k="indices.${x.id}.dims.${j}.1"><span>%</span></div>`).join('')}
        </div></details>`).join('')}
      </div></details>
      <details><summary>연간 일정</summary><div class="se-fields">
        <label for="se-sched-title">일정표 제목 <small>줄바꿈 = 엔터</small></label><textarea id="se-sched-title" data-k="sections.schedule.title" rows="2"></textarea>
        <label for="se-sched-desc">일정표 설명</label><textarea id="se-sched-desc" data-k="sections.schedule.desc" rows="3"></textarea>
        <p class="se-help">달력에서 단계별 시작일과 종료일을 고르세요. 사이트 일정표의 막대에 마우스를 올리면 이 날짜가 그대로 보입니다.</p>
        ${IDX.map(x=>`<details class="se-sub" data-sched="${x.id}"><summary><i style="background:${x.color}"></i>${esc(x.code)} <small>${esc(x.name)}</small></summary><div class="se-fields">${PHASES.map(([ph,l])=>`<div class="se-sched"><span>${l}</span><input type="date" min="${ST.year}-01-01" max="${ST.year}-12-31" aria-label="${esc(x.code)} ${l} 시작일" data-k="schedule.${x.id}.${ph}.0"><em>~</em><input type="date" min="${ST.year}-01-01" max="${ST.year}-12-31" aria-label="${esc(x.code)} ${l} 종료일" data-k="schedule.${x.id}.${ph}.1"></div>`).join('')}</div></details>`).join('')}
      </div></details>
      <details><summary>섹션 제목 · 설명</summary><div class="se-fields">
        ${SECTIONS.map(([id,l])=>`<p class="se-help strong">${l}</p>${inp(`sections.${id}.title`,'제목',{area:1,rows:2,hint:'줄바꿈 = 엔터'})}${inp(`sections.${id}.desc`,'설명',{area:1})}`).join('')}
      </div></details>
      <details><summary>참여 절차 단계</summary><div class="se-fields">
        ${DEFAULTS.steps.map((_,i)=>`<p class="se-help strong">${String(i+1).padStart(2,'0')}단계</p>${inp(`steps.${i}.t`,'제목')}${inp(`steps.${i}.p`,'설명',{area:1,rows:2})}`).join('')}
      </div></details>
      <details><summary>색상</summary><div class="se-fields">
        <div class="se-2"><div><label for="se-accent">포인트 색</label><input type="color" id="se-accent" data-k="accent"></div><div><label for="se-navy">보드 남색</label><input type="color" id="se-navy" data-k="navy"></div></div>
        <div class="se-swatches" id="seSwatches"></div>
      </div></details>
      <details><summary>표시 설정</summary><div class="se-fields">
        <label class="se-check"><input type="checkbox" id="se-autoRotate" data-k="autoRotate"> 행성 자동 회전</label>
        <label class="se-check"><input type="checkbox" id="se-showProcess" data-k="showProcess"> 참여 절차 섹션 보이기</label>
        <label class="se-check"><input type="checkbox" id="se-showSchedule" data-k="showSchedule"> 연간 일정 섹션 보이기</label>
      </div></details>
    </div>
    <footer class="se-foot">
      <p class="se-status" id="seStatus" role="status"></p>
      <div class="se-2"><button type="button" class="se-btn ghost" id="seReset">기본값으로</button><button type="button" class="se-btn" id="seSave">저장</button></div>
      <button type="button" class="se-link" id="seCopy">설정 복사 (JSON)</button>
    </footer>`;
  document.body.append(fab,panel);
  const setEditable=v=>{fab.hidden=!v};
  const status=$('#seStatus');
  $('#seSlogans').innerHTML=SLOGANS.map((s,i)=>`<button type="button" data-s="${i}"><b>${esc(s[0])}</b> ${esc(s[1])}</button>`).join('');
  const SW=[['기본',''],['골드','#9C7A3C'],['로열 블루','#2F5BD3'],['코랄','#D9573B'],['에메랄드','#2E8B6A']];
  $('#seSwatches').innerHTML=SW.map(([n,v])=>`<button type="button" data-sw="${v}" style="--sw:${v||DEF_BRASS}"><i></i>${n}</button>`).join('');

  function toHex(v){v=v.trim();if(hex(v))return v;const m=v.match(/\d+/g);return m?'#'+m.slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join(''):'#000000'}
  function fill(){
    panel.querySelectorAll('[data-k]').forEach(el=>{const k=el.dataset.k,v=getPath(cfg,k);
      if(el.type==='checkbox')el.checked=!!v;
      else if(el.type==='color')el.value=hex(v)||toHex(css.getPropertyValue(k==='accent'?'--brass':'--navy'));
      else{el.value=v==null?'':String(v);el.removeAttribute('aria-invalid')}});
    panel.querySelectorAll('input[name="se-pc"]').forEach(r=>r.checked=r.value===cfg.planetClick);
    IDX.forEach(x=>{const im=$('#se-logo-'+x.id);if(im)im.src=SC.logoUrl(cfg.logos[x.id])||SC.DEFAULT_LOGO[x.id]||x.logo});
    sums();
  }
  function sums(){IDX.forEach(x=>{const el=panel.querySelector(`[data-sum="${x.id}"]`);if(!el)return;const t=cfg.indices[x.id].dims.reduce((a,d)=>a+(+d[1]||0),0);el.textContent=`합계 ${t}%`+(t===100?'':' · 100%가 되도록 맞춰 주세요');el.dataset.bad=t===100?'':'1'})}
  let dirty=false;
  function changed(){dirty=JSON.stringify(cfg)!==JSON.stringify(saved||DEFAULTS);apply(cfg);setStatus(dirty?'저장하지 않은 변경 사항이 있습니다.':'')}
  function setStatus(t,kind){status.textContent=t;status.dataset.kind=kind||''}
  panel.addEventListener('input',e=>{const el=e.target,k=el.dataset.k;
    if(el.name==='se-pc'){cfg.planetClick=el.value;changed();return}
    if(!k)return;
    if(el.type==='checkbox'){setPath(cfg,k,el.checked);changed();return}
    if(k.startsWith('homepages.')){if(el.value&&!okUrl(el.value)){el.setAttribute('aria-invalid','true');return}el.removeAttribute('aria-invalid');setPath(cfg,k,el.value||getPath(DEFAULTS,k));changed();return}
    if(k.startsWith('schedule.')){
      const ks=k.split('.'),r=cfg.schedule[ks[1]][ks[2]].slice();r[+ks[3]]=el.value;
      const pair=panel.querySelectorAll(`[data-k^="schedule.${ks[1]}.${ks[2]}."]`);
      if(!ST.normRange(r)){pair.forEach(x=>x.setAttribute('aria-invalid','true'));setStatus(el.value?'시작일이 종료일보다 늦을 수 없습니다.':'날짜를 골라 주세요.','err');return}
      pair.forEach(x=>x.removeAttribute('aria-invalid'));cfg.schedule[ks[1]][ks[2]]=r;changed();return}
    if(el.type==='number'){
      const v=parseFloat(el.value);if(!isFinite(v)){el.setAttribute('aria-invalid','true');return}
      if(k.startsWith('schedule.')){const ks=k.split('.'),r=cfg.schedule[ks[1]][ks[2]].slice();r[+ks[3]]=Math.round(v*2)/2;
        if(!(r[0]>=1&&r[1]<=13&&r[0]<r[1])){el.setAttribute('aria-invalid','true');return}
        el.removeAttribute('aria-invalid');cfg.schedule[ks[1]][ks[2]]=r;changed();return}
      el.removeAttribute('aria-invalid');setPath(cfg,k,Math.max(0,Math.min(100,Math.round(v))));sums();changed();return}
    panel.querySelectorAll(`[data-k="${k}"]`).forEach(x=>{if(x!==el)x.value=el.value}); /* same setting shown in two groups */
    setPath(cfg,k,el.value);changed()});
  panel.addEventListener('change',e=>{if(e.target.type==='checkbox'){setPath(cfg,e.target.dataset.k,e.target.checked);changed()}});
  $('#seSlogans').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b)return;const s=SLOGANS[+b.dataset.s];cfg.title1=s[0];cfg.title2=s[1];cfg.highlight=s[2];fill();changed()});
  $('#seSwatches').addEventListener('click',e=>{const b=e.target.closest('[data-sw]');if(!b)return;cfg.accent=b.dataset.sw;fill();changed()});
  $('#seReset').onclick=()=>{cfg=clone(DEFAULTS);fill();changed();setStatus('기본값을 불러왔습니다. 저장하면 반영됩니다.')};
  $('#seCopy').onclick=async()=>{const t=JSON.stringify(cfg,null,2);try{await navigator.clipboard.writeText(t);setStatus('설정을 복사했습니다.','ok')}catch(_){let ta=$('#seJson');if(!ta){ta=document.createElement('textarea');ta.id='seJson';ta.rows=6;ta.readOnly=true;ta.setAttribute('aria-label','설정 JSON');$('.se-foot').appendChild(ta)}ta.value=t;ta.focus();ta.select();setStatus('자동 복사가 막혀 있어 아래 칸의 내용을 직접 복사해 주세요.')}};
  $('#seSave').onclick=save;
  $('#seClose').onclick=close;
  fab.onclick=()=>panel.hidden?open():close();
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
  function open(){panel.hidden=false;fill();document.body.classList.add('se-open')}
  function close(){panel.hidden=true;document.body.classList.remove('se-open')}

  /* logo upload: downscale in the page, then the viewer's asset store (claude.ai) or this browser (data URI) */
  let assets=null;
  function shrink(file,max){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c)};im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('decode'))};im.src=u})}
  panel.addEventListener('change',async e=>{const el=e.target;if(!el.dataset.logo||!el.files||!el.files[0])return;const id=el.dataset.logo,f=el.files[0];el.value='';
    try{
      setStatus('로고를 올리는 중…');const c=await shrink(f,800);
      if(backend==='db'){
        if(!assets){setStatus('이 화면에서는 이미지를 올릴 수 없습니다. 편집 권한이 있는 계정으로 열어 주세요.','err');return}
        const blob=await new Promise(r=>c.toBlob(r,'image/png'));const up=await assets.upload(blob,{type:'image/png'});
        cfg.logos[id]='asset:'+up.id;
      }else{const d=c.toDataURL('image/png');if(d.length>600000){setStatus('이미지가 너무 큽니다. 더 작은 파일을 골라 주세요.','err');return}cfg.logos[id]=d}
      fill();changed();setStatus('로고를 바꿨습니다. 저장하면 반영됩니다.');
    }catch(err){setStatus(err&&err.message==='decode'?'이미지를 읽지 못했습니다. PNG나 JPG 파일인지 확인해 주세요.':'로고를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.','err')}});
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-logo-reset]');if(!b)return;cfg.logos[b.dataset.logoReset]='';fill();changed()});

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
- eyebrow: 제목 위 영문 소제목 / title1, title2: 메인 제목 두 줄 / highlight: 금색 강조 단어(반드시 title1 또는 title2 안의 단어)
- lede: 소개 문구 / cta1, cta2: 버튼 글자
- accent, navy: "#rrggbb" 색 ("" = 기본)
- autoRotate, showProcess, showSchedule: true/false
- planetClick: 메인 보드의 행성 로고를 눌렀을 때 동작. "homepage"(지수 공식 사이트로 이동), "detail"(지수 소개로 이동), "flip"(메달 뒤집기)
- sections: {indices|process|schedule: {title(줄바꿈은 \\n), desc}}
- steps: 참여 절차 7단계 배열 [{t: 제목, p: 설명}] (배열 길이 유지)
- indices: {qei|cqi|pbi|well|dcxi: {name, en, desc, target, method, announce, dims}} — dims는 [항목 이름, 가중치%] 4개 배열(합계 100, 길이 유지)
- schedule: {qei|...: {apply(조사 부문 설정)|survey(조사·평가)|notice(조사결과 안내)|award(발표·인증식): ["YYYY-MM-DD" 시작일, "YYYY-MM-DD" 종료일]}} — 종료일 포함, 시작일 ≤ 종료일
- logos: 바꾸지 마세요
- homepages: {qei|cqi|pbi|well|dcxi: https 주소}

사용자 요청: ${q}

규칙: 요청과 관련된 필드만 바꾸세요. 사용자가 주지 않은 홈페이지 주소는 만들지 마세요. 문구는 간결하고 격식 있게 쓰세요. 이 필드들로 할 수 없는 요청이면 patch를 비우고 note에 이유를 쓰세요.
JSON 하나만 답하세요: {"patch": {바꿀 필드만, 위와 같은 구조}, "note": "무엇을 바꿨는지 한국어 한 문장"}`;
    try{
      const r=await sample.json(prompt,{signal:askCtl.signal});
      const patch=r&&typeof r.patch==='object'&&r.patch&&!Array.isArray(r.patch)?r.patch:{};
      cfg=sanitize(merge(DEFAULTS,upgrade(deepAssign(clone(cfg),patch))));fill();changed();
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
  window.KSA_SITE={autoRotate:true,planetClick:DEFAULTS.planetClick};
  try{const raw=localStorage.getItem(LS_KEY);if(raw){saved=sanitize(merge(DEFAULTS,upgrade(JSON.parse(raw))));cfg=clone(saved);apply(cfg)}}catch(_){}
  const wantsEdit=()=>{try{if(location.hash==='#edit')localStorage.setItem(LS_EDIT,'1');return location.hash==='#edit'||localStorage.getItem(LS_EDIT)==='1'}catch(_){return location.hash==='#edit'}};
  function showLocal(){backend='local';$('#seMode').textContent='이 브라우저에만 저장';setEditable(wantsEdit())}
  addEventListener('hashchange',()=>{if(backend!=='db'&&wantsEdit()){setEditable(true);open()}});

  const C=window.claude;
  if(!C||!C.use){showLocal();return}
  C.use('assets').then(a=>{assets=a||null}).catch(()=>{});
  C.use('sample').then(fn=>{if(typeof fn==='function'){sample=fn;$('#seAI').hidden=false}}).catch(()=>{});
  Promise.all([C.use('db'),C.use('user')]).then(async([d,u])=>{
    if(!d){showLocal();return}
    db=d;docRef=db.doc('site/config');
    docRef.onSnapshot(snap=>{
      if(snap.exists){saved=sanitize(merge(DEFAULTS,upgrade(snap.data())));if(!dirty){cfg=clone(saved);apply(cfg);if(!panel.hidden)fill()}}
      else if(!saved)saved=clone(DEFAULTS);
    },()=>{});
    const canEdit=u?(await u.canEdit().catch(()=>false))||(await u.isOwner().catch(()=>false)):false;
    backend='db';$('#seMode').textContent=canEdit?'저장 시 모든 방문자에게 반영':'보기 전용';
    setEditable(canEdit);$('#seSave').hidden=!canEdit;
  }).catch(showLocal);
})();
