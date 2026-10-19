/* 사이트 편집 패널
 * - claude.ai 미리보기: 편집 권한(Editor/Owner)이 있으면 패널이 보이고, 저장 시 db 문서 site/config 에 기록되어 모든 방문자에게 반영됩니다.
 * - 일반 웹 서버: 주소 끝에 #edit 를 붙이면 패널이 열립니다. 저장은 이 브라우저(localStorage)에만 되며,
 *   "설정 복사"로 받은 JSON 을 전달하면 사이트 기본값으로 반영할 수 있습니다.
 */
(function(){
  'use strict';
  const LS_KEY='ksa-site-config',LS_EDIT='ksa-site-edit',LS_DRAFT='ksa-site-draft';
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
  const INDEX_FIELDS=[['name','지수 이름'],['en','영문 이름'],['desc','설명','area'],['target','평가 대상'],['method','평가 방식'],['announce','결과 발표 (예: 10월)'],['greet','캐릭터 인사말']];
  const SECTIONS=[['indices','지수 소개'],['process','참여 절차'],['schedule','연간 일정']];
  const PHASES=[['apply','조사 부문 설정'],['survey','조사 · 평가'],['notice','조사결과 안내'],['award','발표 · 인증식']];
  const SC=window.KSA_SITE_CONFIG||{logoUrl:()=>'',DEFAULT_LOGO:{}};
  const K0=window.__ksa||{};
  const DIMS_TITLE=K0.dimsTitle||'측정 차원';
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
    indices:Object.fromEntries(IDX.map(x=>[x.id,Object.assign(Object.fromEntries(INDEX_FIELDS.map(([k])=>[k,x[k]||''])),{charts:Array.isArray(x.charts)&&x.charts.length?clone(x.charts):[{title:DIMS_TITLE,inline:false,dims:x.dims.map(d=>[d[0],d[1]])}],song:{title:'',text:'',audio:'',dur:0}})])),
    schedule:JSON.parse(JSON.stringify(K0.schedule||{})),
    logos:Object.fromEntries(IDX.map(x=>[x.id,''])),
    explore:Object.assign({},SC.EXPLORE_DEF||{}),
    event:{title:'탐사 완료! 선물이 도착했어요',text:'다섯 지수의 신호를 모두 해독했어요.\n캐릭터 친구들이 준비한 선물을 확인해 보세요.',btn:'메인 사이트로',link:''},
    brand:{logo:'',name:text($('.brand-text b')),sub:text($('.brand-text span')),showText:!($('.brand-text')||{}).hidden},
    homepages:Object.fromEntries(IDX.map(x=>[x.id,x.homepage])),
    results:Object.fromEntries(IDX.map(x=>[x.id,''])) /* each index's survey-results site; empty = button shows 준비 중 */
  };
  let saved=null,base=null,cfg=clone(DEFAULTS),backend='none',db=null,docRef=null; /* base: the stored copy the current edits started from */

  const DIM_MAX=12,CHART_MAX=6,STEP_MAX=12;
  function clone(o){return JSON.parse(JSON.stringify(o))}
  /* keep only the shape of DEFAULTS: unknown keys dropped, wrong types fall back */
  function merge(base,over){
    /* a list of [name, weight] pairs (측정 항목) may grow or shrink; every other list keeps the default length */
    if(Array.isArray(base)&&Array.isArray(base[0])&&Array.isArray(over)&&over.length)return over.slice(0,DIM_MAX).map(o=>merge(base[0],o));
    /* so may an index's list of charts ({title, dims}) */
    if(Array.isArray(base)&&base[0]&&typeof base[0]==='object'&&'dims' in base[0]&&Array.isArray(over)&&over.length)return over.slice(0,CHART_MAX).map(o=>merge(base[0],o));
    /* and so may the process steps ({t, p}) */
    if(Array.isArray(base)&&base[0]&&typeof base[0]==='object'&&'t' in base[0]&&'p' in base[0]&&Array.isArray(over)&&over.length)return over.slice(0,STEP_MAX).map(o=>merge(base[0],o));
    if(Array.isArray(base))return base.map((b,i)=>Array.isArray(over)&&i<over.length?merge(b,over[i]):clone(b));
    if(base&&typeof base==='object'){const o={};for(const k of Object.keys(base))o[k]=over&&typeof over==='object'&&!Array.isArray(over)&&k in over?merge(base[k],over[k]):clone(base[k]);return o}
    return typeof over===typeof base?over:base;
  }
  const okUrl=v=>/^https?:\/\/[^\s]+$/.test(v);
  /* settings saved before exact dates stored months as numbers; turn them into dates before the shape check */
  function upgrade(o){
    /* one weight list per index (dims + a shared dimsTitle) became a list of charts */
    if(o&&o.indices&&typeof o.indices==='object')for(const ix of Object.values(o.indices))if(ix&&typeof ix==='object'&&!Array.isArray(ix.charts)&&Array.isArray(ix.dims)){ix.charts=[{title:typeof o.dimsTitle==='string'&&o.dimsTitle.trim()?o.dimsTitle:DIMS_TITLE,dims:ix.dims}];delete ix.dims}
    /* the process gained a 5th step (조사결과 안내); a saved 6-step list keeps its texts in the right places */
    if(o&&Array.isArray(o.steps)&&o.steps.length===6&&o.steps[4]&&o.steps[4].t==='결과 발표'&&!o.steps.some(s=>s&&s.t==='조사결과 안내'))o.steps.splice(4,0,clone(DEFAULTS.steps[4]));
    if(o&&o.schedule&&typeof o.schedule==='object')for(const id of Object.keys(o.schedule))for(const ph of Object.keys(o.schedule[id]||{})){const r=ST.normRange(o.schedule[id][ph]);if(r)o.schedule[id][ph]=r}return o}
  function sanitize(c){
    for(const id of Object.keys(c.homepages))if(!okUrl(c.homepages[id]))c.homepages[id]=DEFAULTS.homepages[id];
    for(const id of Object.keys(c.results))if(c.results[id]&&!okUrl(c.results[id]))c.results[id]='';
    if(!['homepage','detail','flip'].includes(c.planetClick))c.planetClick='homepage';
    for(const id of Object.keys(c.logos))if(c.logos[id]&&!SC.logoUrl(c.logos[id]))c.logos[id]='';
    if(c.brand.logo&&!SC.logoUrl(c.brand.logo))c.brand.logo='';
    if(c.event.link&&!okUrl(c.event.link))c.event.link='';
    for(const id of Object.keys(c.indices)){const sg=c.indices[id].song;if(sg.audio&&!(SC.audioUrl&&SC.audioUrl(sg.audio)))sg.audio='';if(!sg.audio)sg.dur=0}
    for(const id of Object.keys(c.indices))c.indices[id].charts.forEach(ch=>ch.dims.forEach(d=>{d[1]=Math.max(0,Math.min(100,Math.round(+d[1]||0)))}));
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
    /* "일곱 단계" in the process text follows the number of steps */
    const NUM=['한','두','세','네','다섯','여섯','일곱','여덟','아홉','열','열한','열두'];
    for(const [id] of SECTIONS){const e=secEls(id),v=c.sections[id];if(e.h)e.h.innerHTML=esc(v.title).replace(/\n/g,'<br>');if(e.p)e.p.textContent=id==='process'?v.desc.replace(/(열한|열두|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열) 단계/,NUM[c.steps.length-1]+' 단계'):v.desc}
    /* steps: grow or shrink the list to the saved count, then fill the texts */
    {const ol=$('#process .steps');if(ol){let lis=stepEls();
      while(lis.length>c.steps.length){lis[lis.length-1].remove();lis=stepEls()}
      while(lis.length<c.steps.length){const li=document.createElement('li');li.className=(lis[0]&&lis[0].className||'')+(document.documentElement.classList.contains('rv')?' reveal in':'');li.innerHTML='<h3></h3><p></p>';ol.appendChild(li);lis=stepEls()}
      lis.forEach((li,i)=>{const v=c.steps[i];li.querySelector('h3').textContent=v.t;li.querySelector('p').textContent=v.p});
      ol.style.setProperty('--n',Math.min(c.steps.length,7))}}
    if(SC.applyBrand)SC.applyBrand(c);
    const p=$('#process'),s=$('#schedule');if(p)p.hidden=!c.showProcess;if(s)s.hidden=!c.showSchedule;
    $$('#nav a[href="#process"],footer a[href="#process"]').forEach(a=>a.closest('li,a').hidden=!c.showProcess);
    $$('#nav a[href="#schedule"],footer a[href="#schedule"]').forEach(a=>a.closest('li,a').hidden=!c.showSchedule);
    IDX.forEach(x=>{const o=c.indices[x.id]||{};INDEX_FIELDS.forEach(([f])=>{x[f]=o[f]});x.charts=(o.charts||[]).map(ch=>({title:ch.title,inline:!!ch.inline,dims:ch.dims.map(d=>[d[0],d[1]])}));if(x.charts.length)x.dims=x.charts[0].dims.map(d=>[d[0],d[1]]);
      if(c.homepages[x.id])x.homepage=c.homepages[x.id];
      x.results=c.results[x.id]||'';
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
        ${inp('highlight','금색 강조 단어',{hint:'제목 안에 있는 단어'})}${inp('lede','소개 문구',{area:1,hint:'줄바꿈 = 엔터'})}
        <div class="se-2"><div>${inp('cta1','첫째 버튼')}</div><div>${inp('cta2','둘째 버튼')}</div></div>
      </div></details>
      <details open><summary>사이트 로고 (왼쪽 위)</summary><div class="se-fields">
        <p class="se-help">PNG·JPG·WEBP. 배경이 투명한 가로형 로고가 가장 잘 어울립니다.</p>
        <div class="se-logo"><span class="se-logo-prev wide"><img id="se-logo-__brand" alt="현재 사이트 로고"></span>
          <div><label class="se-btn ghost se-file" for="se-file-__brand">로고 올리기</label><input type="file" id="se-file-__brand" accept="image/png,image/jpeg,image/webp,image/gif" data-logo="__brand" hidden>
          <button type="button" class="se-link" data-logo-reset="__brand">기본 로고로</button></div></div>
        <label class="se-check"><input type="checkbox" id="se-brand-showText" data-k="brand.showText"> 로고 옆에 이름 글자 보이기</label>
        ${inp('brand.name','이름')}${inp('brand.sub','작은 설명')}
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
        <p class="se-help">조사결과 사이트 주소 · 지수 소개의 '조사결과 보기' 버튼에 연결됩니다. 비워 두면 '준비 중'으로 보입니다.</p>
        ${IDX.map(x=>inp(`results.${x.id}`,esc(x.code)+' 조사결과',{type:'url',hint:esc(x.name)})).join('')}
      </div></details>
      <details><summary>지수별 내용</summary><div class="se-fields">
        ${IDX.map(x=>`<details class="se-sub"><summary><i style="background:${x.color}"></i>${esc(x.code)}</summary><div class="se-fields">
          <p class="se-help strong">로고 이미지</p>
          <div class="se-logo"><span class="se-logo-prev"><img id="se-logo-${x.id}" alt="${esc(x.code)} 현재 로고"></span>
            <div><label class="se-btn ghost se-file" for="se-file-${x.id}">이미지 바꾸기</label><input type="file" id="se-file-${x.id}" accept="image/png,image/jpeg,image/webp,image/gif" data-logo="${x.id}" hidden>
            <button type="button" class="se-link" data-logo-reset="${x.id}">기본 로고로</button></div></div>
          ${INDEX_FIELDS.map(([f,l,a])=>inp(`indices.${x.id}.${f}`,l,{area:!!a,rows:4})).join('')}
          <p class="se-help strong">로고송 <small>화성 탐사 화면의 지수 설명에 나옵니다</small></p>
          ${inp(`indices.${x.id}.song.title`,'곡 제목',{hint:'비우면 “지수 이름 + 로고송”'})}
          ${inp(`indices.${x.id}.song.text`,'가사 · 소개',{area:1,rows:5})}
          <div class="se-song"><audio controls preload="none" id="se-song-${x.id}"></audio><p class="se-help" id="se-song-none-${x.id}">음성 파일이 없습니다.</p>
            <div class="se-song-act"><label class="se-btn ghost se-file" for="se-song-file-${x.id}">음성 파일 올리기</label><input type="file" id="se-song-file-${x.id}" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac" data-song="${x.id}" hidden>
            <button type="button" class="se-link" data-song-del="${x.id}">파일 삭제</button></div></div>
          <p class="se-help strong">측정 차원 <small>가중치는 표시하지 않습니다</small></p>
          <div class="se-charts" data-charts="${x.id}"></div>
          <button type="button" class="se-btn ghost se-chart-add" data-chart-add="${x.id}">＋ 묶음 추가</button>
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
        <p class="se-help">단계를 추가하거나 삭제하고, ↑ ↓로 순서를 바꿀 수 있습니다. 번호는 자동으로 매겨집니다.</p>
        <div data-steps></div>
        <button type="button" class="se-btn ghost" data-step-add>＋ 단계 추가</button>
      </div></details>
      <details><summary>탐사 이벤트 (화성)</summary><div class="se-fields">
        <p class="se-help">화성 탐사에서 다섯 지수를 모두 찾으면 캐릭터들이 모여 선물 상자를 열고, 아래 축하 카드가 나옵니다.</p>
        ${inp('event.title','카드 제목')}${inp('event.text','카드 내용',{area:1,rows:3})}
        <div class="se-2"><div>${inp('event.btn','버튼 글자')}</div><div>${inp('event.link','버튼 링크',{type:'url',hint:'비우면 메인 사이트'})}</div></div>
        <a class="se-btn ghost" href="explore.html#finale" target="_blank" rel="noopener" style="text-align:center">이벤트 미리보기 ↗</a>
        <p class="se-help">미리보기는 저장된 내용으로 보입니다. 바꾼 뒤에는 먼저 저장해 주세요.</p>
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
    renderSteps();
    panel.querySelectorAll('[data-k]').forEach(el=>{const k=el.dataset.k,v=getPath(cfg,k);
      if(el.type==='checkbox')el.checked=!!v;
      else if(el.type==='color')el.value=hex(v)||toHex(css.getPropertyValue(k==='accent'?'--brass':'--navy'));
      else{el.value=v==null?'':String(v);el.removeAttribute('aria-invalid')}});
    panel.querySelectorAll('input[name="se-pc"]').forEach(r=>r.checked=r.value===cfg.planetClick);
    {const im=$('#se-logo-__brand');if(im)im.src=SC.logoUrl(cfg.brand.logo)||'assets/brand/ksa-logo.png'}
    IDX.forEach(x=>{const im=$('#se-logo-'+x.id);if(im)im.src=SC.logoUrl(cfg.logos[x.id])||SC.DEFAULT_LOGO[x.id]||x.logo});
    IDX.forEach(x=>renderCharts(x.id));
    IDX.forEach(x=>{const a=$('#se-song-'+x.id),n=$('#se-song-none-'+x.id);if(!a)return;const u=SC.audioUrl?SC.audioUrl(cfg.indices[x.id].song.audio):'';if(a.getAttribute('src')!==u){if(u)a.src=u;else a.removeAttribute('src')}a.hidden=!u;n.hidden=!!u});
    sums();
  }
  /* process steps: rebuilt from cfg whenever one is added, removed or moved */
  function renderSteps(){const box=panel.querySelector('[data-steps]');if(!box)return;const st=cfg.steps,n=st.length;
    box.innerHTML=st.map((s,i)=>`<div class="se-chart"><div class="se-chart-h"><b>${String(i+1).padStart(2,'0')}단계</b>
      <button type="button" class="se-link" data-step-mv="${i}:-1"${i?'':' disabled'} aria-label="${i+1}단계 위로">↑</button><button type="button" class="se-link" data-step-mv="${i}:1"${i<n-1?'':' disabled'} aria-label="${i+1}단계 아래로" style="margin-left:0">↓</button>
      <button type="button" class="se-link" data-step-del="${i}"${n<=1?' disabled':''} style="margin-left:6px">단계 삭제</button></div>
      <label for="se-steps.${i}.t">제목</label><input id="se-steps.${i}.t" data-k="steps.${i}.t" value="${esc(s.t)}">
      <label for="se-steps.${i}.p">설명</label><textarea id="se-steps.${i}.p" data-k="steps.${i}.p" rows="2">${esc(s.p)}</textarea></div>`).join('');
    const add=panel.querySelector('[data-step-add]');if(add)add.disabled=n>=STEP_MAX}
  panel.addEventListener('click',e=>{const a=e.target.closest('[data-step-add],[data-step-del],[data-step-mv]');if(!a||a.disabled)return;const st=cfg.steps;
    if(a.hasAttribute('data-step-add')){if(st.length>=STEP_MAX)return;st.push({t:'새 단계',p:''});renderSteps();changed();const l=panel.querySelector(`[data-k="steps.${st.length-1}.t"]`);if(l){l.focus();l.select()}}
    else if(a.dataset.stepDel){if(st.length<=1)return;st.splice(+a.dataset.stepDel,1);renderSteps();changed()}
    else{const [i,d]=a.dataset.stepMv.split(':').map(Number),j=i+d;if(j<0||j>=st.length)return;[st[i],st[j]]=[st[j],st[i]];renderSteps();changed();const b=panel.querySelector(`[data-step-mv="${j}:${d}"]`);if(b&&!b.disabled)b.focus()}});
  /* 측정 항목 rows: rebuilt from cfg whenever one is added or removed */
  function renderCharts(id){const box=panel.querySelector(`[data-charts="${id}"]`);if(!box)return;const x=IDX.find(i=>i.id===id),chs=cfg.indices[id].charts;
    box.innerHTML=chs.map((ch,c)=>`<div class="se-chart"><div class="se-chart-h"><b>측정 차원 ${c+1}</b><button type="button" class="se-link" data-chart-del="${id}:${c}"${chs.length<=1?' disabled':''}>묶음 삭제</button></div>
      ${c?`<label class="se-check"><input type="checkbox" data-k="indices.${id}.charts.${c}.inline"${ch.inline?' checked':''}> 앞 묶음과 같은 줄에 나란히 놓기</label>`:''}
      <label for="se-indices.${id}.charts.${c}.title">제목</label><input id="se-indices.${id}.charts.${c}.title" data-k="indices.${id}.charts.${c}.title" value="${esc(ch.title)}">
      <div class="se-dims">${ch.dims.map((d,j)=>`<div class="se-dim nw mv" draggable="true" data-dim-at="${id}:${c}:${j}"><span class="se-grip" title="끌어서 위치 이동" aria-hidden="true">⠿</span><input aria-label="${esc(x.code)} 측정 차원 ${j+1}" data-k="indices.${id}.charts.${c}.dims.${j}.0" value="${esc(d[0])}"><button type="button" class="se-mv" data-dim-mv="${id}:${c}:${j}:-1"${c===0&&j===0?' disabled':''} aria-label="항목 ${j+1} 앞으로">↑</button><button type="button" class="se-mv" data-dim-mv="${id}:${c}:${j}:1"${c===chs.length-1&&j===ch.dims.length-1?' disabled':''} aria-label="항목 ${j+1} 뒤로">↓</button><button type="button" class="se-dim-del" data-dim-del="${id}:${c}:${j}" aria-label="${esc(x.code)} 그래프 ${c+1} 항목 ${j+1} 삭제"${ch.dims.length<=1?' disabled':''}>−</button></div>`).join('')}</div>
      <button type="button" class="se-btn ghost se-dim-add" data-dim-add="${id}:${c}"${ch.dims.length>=DIM_MAX?' disabled':''}>＋ 항목 추가</button></div>`).join('');
    const add=panel.querySelector(`[data-chart-add="${id}"]`);if(add)add.disabled=chs.length>=CHART_MAX}
  /* weights are no longer shown or edited */
  function sums(){return;IDX.forEach(x=>cfg.indices[x.id].charts.forEach((ch,c)=>{const el=panel.querySelector(`[data-sum="${x.id}:${c}"]`);if(!el)return;const t=ch.dims.reduce((a,d)=>a+(+d[1]||0),0);el.textContent=`합계 ${t}%`+(t===100?'':' · 100%가 되도록 맞춰 주세요');el.dataset.bad=t===100?'':'1'}))}
  let dirty=false;
  /* unsaved edits are kept as a draft in this browser, so a reload or a closed tab does not lose them.
   * Only the changed fields are kept and laid over the latest stored copy, so an old draft never brings back stale values;
   * drafts from before this format held a whole old copy of the site and are discarded. */
  const draft={put(){try{localStorage.setItem(LS_DRAFT,JSON.stringify({v:2,patch:SC.diff(base||saved||DEFAULTS,cfg)||{}}))}catch(_){}},drop(){try{localStorage.removeItem(LS_DRAFT)}catch(_){}},
    restore(){let d=null;try{d=JSON.parse(localStorage.getItem(LS_DRAFT)||'null')}catch(_){}if(!d)return;
      if(d.v!==2||!d.patch||typeof d.patch!=='object'){draft.drop();return}
      const c=sanitize(merge(DEFAULTS,upgrade(deepAssign(clone(saved||DEFAULTS),d.patch))));if(JSON.stringify(c)===JSON.stringify(saved||DEFAULTS)){draft.drop();return}
      if(!base)base=clone(saved||DEFAULTS);cfg=c;dirty=true;apply(cfg);if(!panel.hidden)fill();setStatus('저장하지 않은 편집 내용을 복원했습니다. 저장을 눌러야 사이트에 반영됩니다.','err')}};
  function changed(){dirty=JSON.stringify(cfg)!==JSON.stringify(saved||DEFAULTS);apply(cfg);if(dirty)draft.put();else draft.drop();setStatus(dirty?'저장하지 않은 변경 사항이 있습니다.':'')}
  addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
  function setStatus(t,kind){status.textContent=t;status.dataset.kind=kind||''}
  panel.addEventListener('input',e=>{const el=e.target,k=el.dataset.k;
    if(el.name==='se-pc'){cfg.planetClick=el.value;changed();return}
    if(!k)return;
    if(el.type==='checkbox'){setPath(cfg,k,el.checked);changed();return}
    if(k==='event.link'){if(el.value&&!okUrl(el.value)){el.setAttribute('aria-invalid','true');return}el.removeAttribute('aria-invalid');setPath(cfg,k,el.value);changed();return}
    if(k.startsWith('results.')){if(el.value&&!okUrl(el.value)){el.setAttribute('aria-invalid','true');return}el.removeAttribute('aria-invalid');setPath(cfg,k,el.value.trim());changed();return}
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
  /* logo song upload. The asset store keeps video/webm (not audio types), so in the claude.ai viewer the file is
   * re-recorded in the page as Opus/WebM (takes as long as the song); in this browser it is kept as given. */
  const toWebm=(f,p)=>SC.toWebm(f,p);
  panel.addEventListener('change',async e=>{const el=e.target;if(!el.dataset.song||!el.files||!el.files[0])return;const id=el.dataset.song,f=el.files[0];el.value='';
    const sg=cfg.indices[id].song;
    try{
      if(f.size>40*1024*1024){setStatus('파일이 너무 큽니다(40MB 이하).','err');return}
      if(backend==='db'){
        if(!assets){setStatus('이 화면에서는 파일을 올릴 수 없습니다. 편집 권한이 있는 계정으로 열어 주세요.','err');return}
        setStatus('음성 파일을 준비하는 중…');
        const {blob,dur}=await toWebm(f,p=>setStatus(`음성 파일을 변환하는 중… ${Math.round(p*100)}% (곡 길이만큼 걸립니다)`));
        if(blob.size>20*1024*1024){setStatus('변환한 파일이 20MB를 넘습니다. 더 짧은 파일을 골라 주세요.','err');return}
        setStatus('음성 파일을 올리는 중…');
        const up=await assets.upload(blob,{type:'video/webm'});sg.audio='asset:'+up.id;sg.dur=Math.round(dur*10)/10;
      }else{
        if(f.size>3*1024*1024){setStatus('이 브라우저에 저장하는 방식은 3MB 이하 파일만 됩니다.','err');return}
        const d=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
        const mt=/^data:(audio|video)\/[\w.+-]+;base64,/.test(d)?d:d.replace(/^data:[^;]*;/,'data:audio/mpeg;');
        sg.audio=mt;sg.dur=await new Promise(r=>{const a=new Audio();a.preload='metadata';a.onloadedmetadata=()=>r(isFinite(a.duration)?Math.round(a.duration*10)/10:0);a.onerror=()=>r(0);a.src=mt});
      }
      fill();changed();setStatus('로고송 파일을 넣었습니다. 저장하면 반영됩니다.');
    }catch(err){const m=err&&err.message;setStatus(m==='noenc'?'이 브라우저에서는 음성 변환을 할 수 없습니다. 크롬이나 엣지에서 다시 시도해 주세요.':m==='decode'?'음성 파일을 읽지 못했습니다. mp3·m4a·wav 파일인지 확인해 주세요.':`음성 파일을 올리지 못했습니다${err&&err.code?` (${err.code})`:''}. 잠시 후 다시 시도해 주세요.`,'err')}});
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-song-del]');if(!b)return;const sg=cfg.indices[b.dataset.songDel].song;sg.audio='';sg.dur=0;fill();changed()});
  panel.addEventListener('change',async e=>{const el=e.target;if(!el.dataset.logo||!el.files||!el.files[0])return;const id=el.dataset.logo,f=el.files[0];el.value='';
    try{
      setStatus('로고를 올리는 중…');const c=await shrink(f,id==='__brand'?480:800);const put=v=>{if(id==='__brand')cfg.brand.logo=v;else cfg.logos[id]=v};
      if(backend==='db'){
        if(!assets){setStatus('이 화면에서는 이미지를 올릴 수 없습니다. 편집 권한이 있는 계정으로 열어 주세요.','err');return}
        const blob=await new Promise(r=>c.toBlob(r,'image/png'));const up=await assets.upload(blob,{type:'image/png'});
        put('asset:'+up.id);
      }else{const d=c.toDataURL('image/png');if(d.length>600000){setStatus('이미지가 너무 큽니다. 더 작은 파일을 골라 주세요.','err');return}put(d)}
      fill();changed();setStatus('로고를 바꿨습니다. 저장하면 반영됩니다.');
    }catch(err){setStatus(err&&err.message==='decode'?'이미지를 읽지 못했습니다. PNG나 JPG 파일인지 확인해 주세요.':'로고를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.','err')}});
  panel.addEventListener('click',e=>{const a=e.target.closest('[data-dim-add],[data-dim-del],[data-chart-add],[data-chart-del]');if(!a||a.disabled)return;
    const focusLast=(id,sel)=>{const ins=panel.querySelectorAll(`[data-charts="${id}"] ${sel}`);const l=ins[ins.length-1];if(l){l.focus();l.select()}};
    if(a.dataset.chartAdd){const id=a.dataset.chartAdd,chs=cfg.indices[id].charts;if(chs.length>=CHART_MAX)return;chs.push({title:'새 측정 차원',inline:true,dims:[['항목 1',0],['항목 2',0]]});renderCharts(id);sums();changed();focusLast(id,'[data-k$=".title"]')}
    else if(a.dataset.chartDel){const [id,c]=a.dataset.chartDel.split(':'),chs=cfg.indices[id].charts;if(chs.length<=1)return;chs.splice(+c,1);renderCharts(id);sums();changed()}
    else if(a.dataset.dimAdd){const [id,c]=a.dataset.dimAdd.split(':'),ds=cfg.indices[id].charts[+c].dims;if(ds.length>=DIM_MAX)return;ds.push(['새 항목',0]);renderCharts(id);sums();changed();const ins=panel.querySelectorAll(`[data-charts="${id}"] .se-chart:nth-child(${+c+1}) .se-dim input:not([type])`);const l=ins[ins.length-1];if(l){l.focus();l.select()}}
    else{const [id,c,j]=a.dataset.dimDel.split(':'),ds=cfg.indices[id].charts[+c].dims;if(ds.length<=1)return;ds.splice(+j,1);renderCharts(id);sums();changed()}});
  /* 측정 항목 order: ↑ ↓ step through the list (crossing into the neighbouring group at its ends), or drag a row onto another */
  function moveDim(id,c,j,tc,tj){const chs=cfg.indices[id].charts,src=chs[c].dims;if(src.length<=1&&c!==tc)return false;
    const [d]=src.splice(j,1);if(c===tc&&tj>j)tj--;chs[tc].dims.splice(Math.max(0,Math.min(tj,chs[tc].dims.length)),0,d);renderCharts(id);changed();return true}
  panel.addEventListener('click',e=>{const a=e.target.closest('[data-dim-mv]');if(!a||a.disabled)return;
    const [id,cs,js,ds]=a.dataset.dimMv.split(':'),c=+cs,j=+js,d=+ds,chs=cfg.indices[id].charts;let tc=c,tj=j+d;
    if(d>0)tj=j+2; /* insert after the next item */
    if(d<0&&j===0){if(!c)return;tc=c-1;tj=chs[tc].dims.length}
    else if(d>0&&j===chs[c].dims.length-1){if(c===chs.length-1)return;tc=c+1;tj=0}
    if(moveDim(id,c,j,tc,tj)){const k=tc===c?j+d:tj;const b=panel.querySelector(`[data-dim-mv="${id}:${tc}:${Math.max(0,k)}:${d}"]`);if(b&&!b.disabled)b.focus()}});
  let dragFrom=null;
  panel.addEventListener('dragstart',e=>{const r=e.target.closest&&e.target.closest('[data-dim-at]');if(!r||e.target.tagName==='INPUT')return;dragFrom=r.dataset.dimAt;r.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragFrom)}catch(_){}});
  panel.addEventListener('dragend',()=>{dragFrom=null;panel.querySelectorAll('.dragging,.drop-at').forEach(x=>x.classList.remove('dragging','drop-at'))});
  panel.addEventListener('dragover',e=>{if(!dragFrom)return;const r=e.target.closest('[data-dim-at]');if(!r||r.dataset.dimAt.split(':')[0]!==dragFrom.split(':')[0])return;e.preventDefault();panel.querySelectorAll('.drop-at').forEach(x=>x!==r&&x.classList.remove('drop-at'));r.classList.add('drop-at')});
  panel.addEventListener('drop',e=>{if(!dragFrom)return;const r=e.target.closest('[data-dim-at]');if(!r)return;e.preventDefault();
    const [id,c,j]=dragFrom.split(':'),[tid,tc,tj]=r.dataset.dimAt.split(':');dragFrom=null;if(id!==tid||(c===tc&&j===tj))return;
    const after=e.clientY>r.getBoundingClientRect().top+r.offsetHeight/2;moveDim(id,+c,+j,+tc,+tj+(after?1:0))});
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-logo-reset]');if(!b)return;const r=b.dataset.logoReset;if(r==='__brand')cfg.brand.logo='';else cfg.logos[r]='';fill();changed()});

  async function save(){
    const btn=$('#seSave');btn.disabled=true;setStatus('저장 중…');
    try{
      /* in the claude.ai viewer the shared store may still be connecting: wait for it instead of silently saving to this browser */
      if(backend==='none')await Promise.race([backendReady,new Promise(r=>setTimeout(r,8000))]);
      if(backend==='none')throw new Error('connect');
      /* set() resolving means the store accepted the write (a read straight after can still return the previous copy) */
      if(backend==='db'){
        /* write only what was changed here, so edits made elsewhere meanwhile (explore page, logo songs) are kept */
        const snap=await docRef.get();const patch=snap.exists?SC.diff(base||saved||DEFAULTS,cfg):clone(cfg);
        const go=()=>patch===undefined?Promise.resolve():snap.exists?docRef.update(patch):docRef.set(patch);
        try{await go()}catch(e){if(e&&e.code==='unavailable'){await new Promise(r=>setTimeout(r,600+Math.random()*600));await go()}else throw e}
        setStatus('저장했습니다. 이 페이지를 보는 모든 사람에게 반영됩니다.','ok')}
      else{try{let o=null;try{o=JSON.parse(localStorage.getItem(LS_KEY)||'null')}catch(_){}const p=SC.diff(base||saved||DEFAULTS,cfg);localStorage.setItem(LS_KEY,JSON.stringify(p&&o&&typeof o==='object'?deepAssign(o,p):cfg))}catch(_){throw new Error('local')}setStatus('이 브라우저에 저장했습니다. 사이트 전체에 반영하려면 "설정 복사"로 받은 내용을 전달해 주세요.','ok')}
      saved=clone(cfg);base=clone(cfg);dirty=false;draft.drop();
    }catch(e){
      if(e&&e.code==='invalid_argument')setStatus('저장 권한이 없습니다. 편집 권한이 있는 계정으로 열어 주세요.','err');
      else if(e&&e.message==='local')setStatus('이 브라우저에서는 저장소를 쓸 수 없습니다. "설정 복사"를 이용해 주세요.','err');
      else if(e&&e.message==='connect')setStatus('저장소에 연결하지 못했습니다. 편집 내용은 이 브라우저에 임시 보관했으니 잠시 후 다시 저장해 주세요.','err');
      else setStatus('저장하지 못했습니다'+(e&&(e.code||e.message)?` (${e.code||e.message})`:'')+'. 편집 내용은 이 브라우저에 임시 보관했으니 다시 저장해 주세요.','err');
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
- steps: 참여 절차 단계 배열 [{t: 제목, p: 설명}] (1~12단계)
- indices: {qei|cqi|pbi|well|dcxi: {name, en, desc, target, method, announce, charts}} — charts는 그래프 1~6개 [{title: 그래프 제목, inline: true면 앞 그래프와 같은 줄(한 줄 최대 3개), dims: [[항목 이름, 가중치%] 1~12개, 합계 100]}]
- schedule: {qei|...: {apply(조사 부문 설정)|survey(조사·평가)|notice(조사결과 안내)|award(발표·인증식): ["YYYY-MM-DD" 시작일, "YYYY-MM-DD" 종료일]}} — 종료일 포함, 시작일 ≤ 종료일
- event: {title, text, btn, link} — 화성 탐사 완료 이벤트의 축하 카드 (link는 https 주소 또는 빈칸)
- logos, brand.logo, indices.*.song.audio/dur: 바꾸지 마세요 (song.title, song.text 는 바꿔도 됩니다) (brand.name/brand.sub/brand.showText 는 바꿔도 됩니다)
- homepages: {qei|cqi|pbi|well|dcxi: https 주소}
- results: {qei|cqi|pbi|well|dcxi: 조사결과 사이트 https 주소 또는 빈 문자열}

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
  /* the last saved settings ship with the page (site-saved.js) and act as its defaults */
  if(window.KSA_SAVED_CONFIG&&typeof window.KSA_SAVED_CONFIG==='object'){try{const b=sanitize(merge(DEFAULTS,upgrade(clone(window.KSA_SAVED_CONFIG))));for(const k of Object.keys(DEFAULTS))DEFAULTS[k]=b[k];cfg=clone(DEFAULTS);apply(cfg)}catch(_){}}
  window.KSA_SITE={autoRotate:true,planetClick:DEFAULTS.planetClick};
  try{const raw=localStorage.getItem(LS_KEY);if(raw){saved=sanitize(merge(DEFAULTS,upgrade(JSON.parse(raw))));cfg=clone(saved);base=clone(saved);apply(cfg)}}catch(_){}
  const wantsEdit=()=>{try{if(location.hash==='#edit')localStorage.setItem(LS_EDIT,'1');return location.hash==='#edit'||localStorage.getItem(LS_EDIT)==='1'}catch(_){return location.hash==='#edit'}};
  let backendSet;const backendReady=new Promise(r=>backendSet=r);
  function showLocal(){backend='local';backendSet();draft.restore();$('#seMode').textContent='이 브라우저에만 저장';setEditable(wantsEdit())}
  addEventListener('hashchange',()=>{if(backend!=='db'&&wantsEdit()){setEditable(true);open()}});

  const C=window.claude;
  if(!C||!C.use){showLocal();return}
  C.use('assets').then(a=>{assets=a||null}).catch(()=>{});
  C.use('sample').then(fn=>{if(typeof fn==='function'){sample=fn;$('#seAI').hidden=false}}).catch(()=>{});
  Promise.all([C.use('db'),C.use('user')]).then(async([d,u])=>{
    if(!d){showLocal();return}
    db=d;docRef=db.doc('site/config');
    let first=true;
    const take=snap=>{
      if(snap.exists){saved=sanitize(merge(DEFAULTS,upgrade(snap.data())));if(!dirty){cfg=clone(saved);base=clone(saved);apply(cfg);if(!panel.hidden)fill()}}
      else if(!saved)saved=clone(DEFAULTS);
      if(first){first=false;draft.restore()}
    };
    /* read once directly, then follow live changes; a live subscription that fails or never answers must not leave the defaults on screen */
    docRef.get().then(take).catch(()=>{});
    try{docRef.onSnapshot(take,()=>{docRef.get().then(take).catch(()=>{})})}catch(_){}
    const canEdit=u?(await u.canEdit().catch(()=>false))||(await u.isOwner().catch(()=>false)):false;
    backend='db';backendSet();$('#seMode').textContent=canEdit?'저장 시 모든 방문자에게 반영':'보기 전용';
    setEditable(canEdit);$('#seSave').hidden=!canEdit;
  }).catch(showLocal);
})();
