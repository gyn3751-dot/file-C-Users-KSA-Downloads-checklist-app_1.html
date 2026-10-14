/* 화성 탐사 페이지 편집 패널 — 시작 화면 문구, 지수별 캐릭터 인사말·설명·로고송, 탐사 완료 이벤트 카드.
 * 메인 사이트와 같은 설정(claude.ai: db 문서 site/config, 그 밖: 이 브라우저의 localStorage)에 저장하되,
 * 이 페이지에서 다루는 항목만 덧붙여 저장하므로 메인 페이지의 다른 설정은 그대로 남습니다.
 */
(function(){
  'use strict';
  const SC=window.KSA_SITE_CONFIG,X=window.KSA_EXPLORE,IDX=window.KSA_INDICES||[];
  if(!SC||!X)return;
  const LS_KEY=SC.LS_KEY,LS_EDIT='ksa-site-edit',LS_DRAFT='ksa-explore-draft';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const clone=o=>JSON.parse(JSON.stringify(o));
  const okUrl=v=>/^https?:\/\/[^\s]+$/.test(v);
  const IDX_FIELDS=[['greet','캐릭터 인사말'],['desc','설명','area'],['target','평가 대상'],['announce','결과 발표 (예: 10월)']];

  /* the editable slice of the shared config, seeded from what the page shows now */
  const fromPage=()=>({
    explore:clone(X.EXPLORE),
    event:clone(X.EVENT),
    indices:Object.fromEntries(IDX.map(x=>{const s=x.song||{};return [x.id,{greet:x.greet||'',desc:x.desc||'',target:x.target||'',announce:x.announce||'',
      song:{title:s.title||'',text:s.text||'',audio:'',dur:+s.dur||0}}]}))
  });
  let cfg=null,saved=null,dirty=false,backend='none',docRef=null,assets=null,cur=IDX[0]&&IDX[0].id;

  /* ── styles (scoped to the panel) ── */
  const st=document.createElement('style');
  st.textContent=`
.xe-fab{position:fixed;left:calc(var(--pad,16px) + env(safe-area-inset-left,0px));top:calc(var(--pad,16px) + 70px + env(safe-area-inset-top,0px));z-index:12;height:36px;padding:0 14px;border-radius:999px;display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--fg);cursor:pointer}
.xe-fab[hidden]{display:none}
.xe-fab:hover{border-color:var(--gold)}
.xe{position:fixed;top:0;right:0;bottom:0;width:min(400px,100%);z-index:40;display:flex;flex-direction:column;background:rgba(24,13,11,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-left:1px solid var(--line);color:var(--fg);box-shadow:-20px 0 50px -20px rgba(0,0,0,.7)}
.xe[hidden]{display:none}
.xe-h{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 18px 12px;border-bottom:1px solid var(--line)}
.xe-h b{font-size:1rem}.xe-h small{display:block;margin-top:2px;font-size:.72rem;color:var(--mute)}
.xe-x{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--fg);cursor:pointer}
.xe-body{flex:1;overflow-y:auto;padding:6px 18px 18px}
.xe details{border-bottom:1px solid var(--line)}
.xe summary{cursor:pointer;padding:14px 0;font-weight:600;font-size:.9rem;list-style:none;display:flex;justify-content:space-between}
.xe summary::after{content:"+";color:var(--mute)}.xe details[open] summary::after{content:"−"}
.xe-f{display:flex;flex-direction:column;gap:8px;padding:0 0 16px}
.xe label{font-size:.74rem;color:var(--mute)}.xe label small{opacity:.8}
.xe input:not([type=file]),.xe textarea{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--fg);font:inherit;font-size:.86rem;padding:9px 10px;border-radius:8px}
.xe textarea{resize:vertical;line-height:1.55}
.xe input:focus,.xe textarea:focus{outline:none;border-color:var(--gold)}
.xe input[aria-invalid=true]{border-color:#E0705A}
.xe-tabs{display:flex;flex-wrap:wrap;gap:6px}
.xe-tabs button{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--fg);font-size:.76rem;cursor:pointer}
.xe-tabs button i{width:8px;height:8px;border-radius:50%;background:var(--c)}
.xe-tabs button[aria-selected=true]{border-color:var(--c);background:color-mix(in srgb,var(--c) 22%,transparent)}
.xe-help{margin:0;font-size:.74rem;color:var(--mute);line-height:1.5}
.xe-sub{margin:6px 0 0;font-size:.78rem;font-weight:600}
.xe-song{border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px}
.xe-song audio{width:100%;height:34px}
.xe-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.xe-btn{height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--fg);font-size:.8rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.xe-btn:hover{border-color:var(--fg)}
.xe-btn.pri{background:var(--fg);color:#1A0E0B;border-color:var(--fg);font-weight:600}
.xe-btn:disabled{opacity:.45;cursor:not-allowed}
.xe-link{background:none;border:0;color:var(--mute);text-decoration:underline;font-size:.76rem;cursor:pointer;padding:0}
.xe-foot{padding:12px 18px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.xe-status{margin:0;font-size:.76rem;min-height:1.2em;color:var(--mute)}
.xe-status[data-k=ok]{color:#9BD68A}.xe-status[data-k=err]{color:#F09A86}
.xe-foot .xe-row .xe-btn{flex:1}
@media (max-width:700px){.xe-fab{top:auto;bottom:calc(196px + env(safe-area-inset-bottom,0px))}}`;
  document.head.appendChild(st);

  /* ── markup ── */
  const fab=document.createElement('button');fab.type='button';fab.className='xe-fab glass';fab.hidden=true;fab.innerHTML='✎ 탐사 페이지 편집';
  document.body.appendChild(fab);
  const panel=document.createElement('aside');panel.className='xe';panel.hidden=true;panel.setAttribute('aria-label','탐사 페이지 편집');
  const inp=(k,l,o={})=>`<label for="xe-${k}">${l}${o.hint?` <small>${o.hint}</small>`:''}</label>`+(o.area?`<textarea id="xe-${k}" data-k="${k}" rows="${o.rows||3}"></textarea>`:`<input id="xe-${k}" data-k="${k}"${o.url?' type="url" inputmode="url" placeholder="https://"':''}>`);
  panel.innerHTML=`
    <div class="xe-h"><div><b>탐사 페이지 편집</b><small id="xeMode"></small></div><button class="xe-x" type="button" id="xeClose" aria-label="닫기">✕</button></div>
    <div class="xe-body">
      <details open><summary>시작 화면</summary><div class="xe-f">
        ${inp('explore.eyebrow','작은 제목')}${inp('explore.title','큰 제목',{hint:'줄바꿈 = 엔터',area:1,rows:2})}${inp('explore.desc','설명',{area:1,rows:4})}
        <div class="xe-row" style="gap:8px;align-items:stretch"><div style="flex:1">${inp('explore.start','시작 버튼')}</div><div style="flex:1">${inp('explore.list','목록 버튼')}</div></div>
      </div></details>
      <details open><summary>지수별 내용</summary><div class="xe-f">
        <div class="xe-tabs" role="tablist" id="xeTabs">${IDX.map(x=>`<button type="button" role="tab" data-id="${x.id}" style="--c:${x.color}"><i></i>${esc(x.code)}</button>`).join('')}</div>
        <p class="xe-help">지수 로고를 눌렀을 때 오른쪽 창에 나오는 내용입니다. 이름·홈페이지·로고·그래프는 메인 페이지의 사이트 편집에서 바꿀 수 있습니다.</p>
        <div id="xeIdx"></div>
      </div></details>
      <details><summary>탐사 완료 이벤트</summary><div class="xe-f">
        <p class="xe-help">다섯 지수를 모두 찾으면 ‘탐사 완료’ 문구와 함께 지도 한가운데에 빛나는 별이 나타나고, 별을 누르면 캐릭터들이 모여 선물 상자를 엽니다.</p>
        ${inp('explore.doneTitle','탐사 완료 문구')}${inp('explore.doneText','완료 안내',{area:1,rows:2})}
        <p class="xe-sub">선물 상자가 열린 뒤 나오는 축하 카드</p>
        ${inp('event.title','카드 제목')}${inp('event.text','카드 내용',{area:1,rows:3})}
        <div class="xe-row" style="align-items:stretch"><div style="flex:1">${inp('event.btn','버튼 글자')}</div><div style="flex:1">${inp('event.link','버튼 링크',{url:1,hint:'비우면 메인'})}</div></div>
        <button type="button" class="xe-btn" id="xePreview">이벤트 미리보기 ▶</button>
      </div></details>
    </div>
    <div class="xe-foot"><p class="xe-status" id="xeStatus" role="status"></p>
      <div class="xe-row"><button type="button" class="xe-btn" id="xeReset">되돌리기</button><button type="button" class="xe-btn pri" id="xeSave">저장</button></div></div>`;
  document.body.appendChild(panel);
  const status=$('#xeStatus');const setStatus=(t,k)=>{status.textContent=t;status.dataset.k=k||''};

  function idxHTML(id){const x=IDX.find(i=>i.id===id);return `
    ${IDX_FIELDS.map(([f,l,a])=>inp(`indices.${id}.${f}`,l,{area:!!a,rows:4})).join('')}
    <p class="xe-sub">로고송</p>
    ${inp(`indices.${id}.song.title`,'곡 제목',{hint:'비우면 “지수 이름 + 로고송”'})}
    ${inp(`indices.${id}.song.text`,'가사 · 소개',{area:1,rows:5})}
    <div class="xe-song"><audio controls preload="none" id="xeAudio"></audio><p class="xe-help" id="xeNoAudio">음성 파일이 없습니다.</p>
      <div class="xe-row"><label class="xe-btn" for="xeFile" style="font-size:.8rem;color:var(--fg)">음성 파일 올리기</label><input type="file" id="xeFile" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac" hidden>
      <button type="button" class="xe-link" id="xeDelAudio">파일 삭제</button></div></div>
    <button type="button" class="xe-btn" id="xeShow" style="--c:${x.color}">이 지수 창 열어 보기</button>`}

  const getPath=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
  const setPath=(o,p,v)=>{const ks=p.split('.'),l=ks.pop();ks.reduce((a,k)=>a[k],o)[l]=v};
  function fill(){
    panel.querySelectorAll('#xeTabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.id===cur));
    $('#xeIdx').innerHTML=idxHTML(cur);
    panel.querySelectorAll('[data-k]').forEach(el=>{const v=getPath(cfg,el.dataset.k);el.value=v==null?'':String(v);el.removeAttribute('aria-invalid')});
    const a=$('#xeAudio'),u=SC.audioUrl(cfg.indices[cur].song.audio);if(u)a.src=u;else a.removeAttribute('src');a.hidden=!u;$('#xeNoAudio').hidden=!!u;
  }

  /* ── apply the slice to the live page ── */
  function apply(){
    Object.assign(X.EXPLORE,cfg.explore);X.applyIntro();
    Object.assign(X.EVENT,cfg.event);
    IDX.forEach(x=>{const o=cfg.indices[x.id];if(!o)return;IDX_FIELDS.forEach(([f])=>{x[f]=o[f]});
      const s=o.song;x.song={title:s.title,text:s.text,audio:SC.audioUrl(s.audio),dur:+s.dur||0}});
    X.refresh();
  }
  const draft={put(){try{localStorage.setItem(LS_DRAFT,JSON.stringify(cfg))}catch(_){}},drop(){try{localStorage.removeItem(LS_DRAFT)}catch(_){}}};
  function changed(){dirty=JSON.stringify(cfg)!==JSON.stringify(saved);apply();if(dirty)draft.put();else draft.drop();setStatus(dirty?'저장하지 않은 변경 사항이 있습니다.':'')}
  addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

  panel.addEventListener('input',e=>{const el=e.target,k=el.dataset.k;if(!k)return;
    if(k==='event.link'&&el.value&&!okUrl(el.value)){el.setAttribute('aria-invalid','true');return}
    el.removeAttribute('aria-invalid');setPath(cfg,k,el.value);changed()});
  panel.addEventListener('click',e=>{
    const tab=e.target.closest('#xeTabs button');if(tab){cur=tab.dataset.id;fill();return}
    if(e.target.closest('#xeShow')){const i=IDX.findIndex(x=>x.id===cur);if(i>=0&&window.KSA_EXPLORE_GO){close();window.KSA_EXPLORE_GO(i)}return}
    if(e.target.closest('#xeDelAudio')){const s=cfg.indices[cur].song;s.audio='';s.dur=0;fill();changed()}
  });
  $('#xePreview').onclick=()=>{if(!X.preview())setStatus('지형을 불러온 뒤에 미리볼 수 있습니다.','err');else close()};
  $('#xeReset').onclick=()=>{cfg=clone(saved);draft.drop();fill();changed()};
  $('#xeClose').onclick=close;
  fab.onclick=()=>{fill();panel.hidden=false};
  function close(){panel.hidden=true}

  /* logo song upload */
  panel.addEventListener('change',async e=>{if(e.target.id!=='xeFile')return;const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;const id=cur,s=cfg.indices[id].song;
    try{
      if(f.size>40*1024*1024){setStatus('파일이 너무 큽니다(40MB 이하).','err');return}
      if(backend==='db'){
        if(!assets){setStatus('이 화면에서는 파일을 올릴 수 없습니다. 편집 권한이 있는 계정으로 열어 주세요.','err');return}
        setStatus('음성 파일을 준비하는 중…');
        const {blob,dur}=await SC.toWebm(f,p=>setStatus(`음성 파일을 변환하는 중… ${Math.round(p*100)}% (곡 길이만큼 걸립니다)`));
        if(blob.size>20*1024*1024){setStatus('변환한 파일이 20MB를 넘습니다. 더 짧은 파일을 골라 주세요.','err');return}
        setStatus('음성 파일을 올리는 중…');const up=await assets.upload(blob,{type:'video/webm'});s.audio='asset:'+up.id;s.dur=Math.round(dur*10)/10;
      }else{
        if(f.size>3*1024*1024){setStatus('이 브라우저에 저장하는 방식은 3MB 이하 파일만 됩니다.','err');return}
        const d=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
        s.audio=/^data:(audio|video)\/[\w.+-]+;base64,/.test(d)?d:d.replace(/^data:[^;]*;/,'data:audio/mpeg;');
        s.dur=await new Promise(r=>{const a=new Audio();a.preload='metadata';a.onloadedmetadata=()=>r(isFinite(a.duration)?Math.round(a.duration*10)/10:0);a.onerror=()=>r(0);a.src=s.audio});
      }
      if(id===cur)fill();changed();setStatus('로고송 파일을 넣었습니다. 저장하면 반영됩니다.');
    }catch(err){const m=err&&err.message;setStatus(m==='noenc'?'이 브라우저에서는 음성 변환을 할 수 없습니다. 크롬이나 엣지에서 다시 시도해 주세요.':m==='decode'?'음성 파일을 읽지 못했습니다. mp3·m4a·wav 파일인지 확인해 주세요.':`음성 파일을 올리지 못했습니다${err&&err.code?` (${err.code})`:''}.`,'err')}});

  /* ── save: only this page's fields are merged into the shared config ── */
  function patch(){return {explore:clone(cfg.explore),event:clone(cfg.event),indices:clone(cfg.indices)}}
  function deepAssign(t,s){for(const k of Object.keys(s)){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])&&t[k]&&typeof t[k]==='object'&&!Array.isArray(t[k]))deepAssign(t[k],s[k]);else t[k]=s[k]}return t}
  $('#xeSave').onclick=async()=>{const btn=$('#xeSave');btn.disabled=true;setStatus('저장 중…');
    try{
      const p=patch();
      if(backend==='db'){
        const snap=await docRef.get();
        const go=d=>snap.exists?docRef.update(d):docRef.set(d);
        try{await go(p)}catch(e){if(e&&e.code==='unavailable'){await new Promise(r=>setTimeout(r,700));await go(p)}else throw e}
        setStatus('저장했습니다. 이 페이지를 보는 모든 사람에게 반영됩니다.','ok');
      }else{
        let o=null;try{o=JSON.parse(localStorage.getItem(LS_KEY)||'null')}catch(_){}
        try{localStorage.setItem(LS_KEY,JSON.stringify(deepAssign(o&&typeof o==='object'?o:{},p)))}catch(_){throw new Error('local')}
        setStatus('이 브라우저에 저장했습니다.','ok');
      }
      saved=clone(cfg);dirty=false;draft.drop();
    }catch(e){setStatus(e&&e.message==='local'?'이 브라우저에서는 저장할 수 없습니다.':`저장하지 못했습니다${e&&(e.code||e.message)?` (${e.code||e.message})`:''}. 편집 내용은 이 브라우저에 임시 보관했습니다.`,'err')}
    finally{btn.disabled=false}};

  /* ── boot: wait for the page to apply the saved config, then seed from it ── */
  function seed(){
    cfg=fromPage();
    /* stored audio pointers (the page only keeps their display URLs) */
    const c=X.cfg;if(c&&c.indices)IDX.forEach(x=>{const s=c.indices[x.id]&&c.indices[x.id].song;if(s&&typeof s.audio==='string'&&SC.audioUrl(s.audio)){cfg.indices[x.id].song.audio=s.audio;cfg.indices[x.id].song.dur=+s.dur||0}});
    if(c&&c.event&&typeof c.event.link==='string')cfg.event.link=c.event.link;
    saved=clone(cfg);
    let d=null;try{d=JSON.parse(localStorage.getItem(LS_DRAFT)||'null')}catch(_){}
    if(d&&d.explore&&d.indices&&d.event&&JSON.stringify(d)!==JSON.stringify(saved)){deepAssign(cfg,d);dirty=true;apply();setStatus('저장하지 않은 편집 내용을 복원했습니다. 저장을 눌러야 반영됩니다.','err')}
  }
  const wantsEdit=()=>{try{if(location.hash==='#edit')localStorage.setItem(LS_EDIT,'1');return location.hash==='#edit'||localStorage.getItem(LS_EDIT)==='1'}catch(_){return location.hash==='#edit'}};
  const showFab=on=>{fab.hidden=!on;document.body.classList.toggle('xe-on',!!on)};
  const waitCfg=()=>new Promise(r=>{const t0=Date.now();(function poll(){if(X.cfg!==null||Date.now()-t0>3500)r();else setTimeout(poll,120)})()});
  waitCfg().then(()=>{
    seed();
    const C=window.claude;
    if(!C||!C.use){backend='local';$('#xeMode').textContent='이 브라우저에만 저장';showFab(wantsEdit());return}
    C.use('assets').then(a=>{assets=a||null}).catch(()=>{});
    Promise.all([C.use('db'),C.use('user')]).then(async([db,u])=>{
      if(!db){backend='local';$('#xeMode').textContent='이 브라우저에만 저장';showFab(wantsEdit());return}
      docRef=db.doc('site/config');backend='db';
      const can=u?(await u.canEdit().catch(()=>false))||(await u.isOwner().catch(()=>false)):false;
      $('#xeMode').textContent='저장 시 모든 방문자에게 반영';showFab(can);
    }).catch(()=>{backend='local';showFab(wantsEdit())});
  });
})();
