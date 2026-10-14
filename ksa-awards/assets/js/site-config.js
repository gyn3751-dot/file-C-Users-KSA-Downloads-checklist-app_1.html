/* 사이트 설정 공용 도우미 — index.html(편집 패널)과 explore.html(탐사 모드)이 함께 씁니다.
 * 설정은 claude.ai 미리보기에서는 db 문서 site/config, 그 밖에서는 이 브라우저의 localStorage 에 있습니다.
 */
(function(){
  'use strict';
  const LS_KEY='ksa-site-config';
  const IDX=window.KSA_INDICES||[];
  /* default logo per index, captured before any setting changes it */
  const DEFAULT_LOGO=Object.fromEntries(IDX.map(x=>[x.id,x.logo]));

  /* a stored logo value: "asset:<id>" (uploaded in the claude.ai viewer) or a data: image (saved in this browser) */
  function logoUrl(v){
    if(typeof v!=='string')return '';
    if(/^asset:[0-9a-f]{32}$/.test(v))return '/_blob/'+v.slice(6);
    if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v))return v;
    return '';
  }
  /* a stored logo-song file: "asset:<id>" (uploaded in the claude.ai viewer, webm) or an audio data: URI (saved in this browser) */
  function audioUrl(v){
    if(typeof v!=='string')return '';
    if(/^asset:[0-9a-f]{32}$/.test(v))return '/_blob/'+v.slice(6);
    if(/^data:(audio|video)\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(v))return v;
    return '';
  }
  /* the image a canvas texture should be drawn from: an embedded data URI for the bundled logos (never taints) */
  function textureSrc(x){return x.logoCustom?x.logo:((window.KSA_LOGO_DATA||{})[x.id]||x.logo)}

  /* apply the per-index parts of a config (names, copy, weights, homepage, logo) to KSA_INDICES */
  function applyIndices(c){
    if(!c||typeof c!=='object')return;
    IDX.forEach(x=>{
      const o=c.indices&&c.indices[x.id];
      if(o&&typeof o==='object'){
        for(const k of ['name','en','desc','target','method','announce','greet'])if(typeof o[k]==='string'&&o[k].trim())x[k]=o[k];
        const okDims=ds=>Array.isArray(ds)&&ds.length>=1&&ds.length<=12&&ds.every(d=>Array.isArray(d)&&typeof d[0]==='string'&&typeof d[1]==='number');
        const cp=ds=>ds.map(d=>[d[0],Math.max(0,Math.min(100,d[1]))]);
        if(Array.isArray(o.charts)&&o.charts.length&&o.charts.every(ch=>ch&&typeof ch.title==='string'&&okDims(ch.dims))){x.charts=o.charts.slice(0,6).map(ch=>({title:ch.title,inline:!!ch.inline,dims:cp(ch.dims)}));x.dims=cp(x.charts[0].dims)}
        else if(okDims(o.dims))x.dims=cp(o.dims);
      }
      const sg=o&&o.song;
      if(sg&&typeof sg==='object')x.song={title:typeof sg.title==='string'?sg.title:'',text:typeof sg.text==='string'?sg.text:'',audio:audioUrl(sg.audio),dur:typeof sg.dur==='number'?sg.dur:0};
      const h=c.homepages&&c.homepages[x.id];
      if(typeof h==='string'&&/^https?:\/\/\S+$/.test(h))x.homepage=h;
      const u=logoUrl(c.logos&&c.logos[x.id]);
      x.logo=u||DEFAULT_LOGO[x.id];x.logoCustom=!!u;
    });
  }

  /* the site's own logo + name (top-left mark, footer, explore HUD); empty logo = the logo built into the page */
  function applyBrand(c){
    const b=c&&c.brand;if(!b||typeof b!=='object')return;
    const u=logoUrl(b.logo);
    document.querySelectorAll('.brand-mark,.back .mk').forEach(m=>{
      if(!m._def)m._def={html:m.innerHTML,cls:m.className};
      if(u){m.classList.add('has-img');let im=m.querySelector('img');if(!im){m.textContent='';im=document.createElement('img');im.alt='';m.appendChild(im)}if(im.getAttribute('src')!==u)im.src=u}
      else if(m.innerHTML!==m._def.html){m.innerHTML=m._def.html;m.className=m._def.cls}
    });
    document.querySelectorAll('.brand-text').forEach(t=>{
      const n=t.querySelector('b'),s=t.querySelector('span');
      if(typeof b.name==='string'&&b.name.trim()&&n)n.textContent=b.name;
      if(typeof b.sub==='string'&&s)s.textContent=b.sub;
      t.hidden=b.showText===false;
    });
  }

  /* texts of the explore page's start screen (edited on that page, kept in the same config under "explore") */
  const EXPLORE_DEF={eyebrow:'KSA Index Expedition · Sol 01',title:'붉은 행성에서\n우리 기업의 지수를 찾아보세요',
    desc:'게일 분화구 곳곳에 다섯 개의 지수 신호가 착륙해 있습니다. 빛기둥을 따라 다가가면 로고가 드러나고, 원하는 지수를 선택해 공식 홈페이지로 이동할 수 있습니다.',
    start:'탐사 시작',list:'지수 목록 바로 보기'};

  /* logo-song upload helper: the asset store keeps video/webm (not audio types), so a file is re-recorded in the page
   * as Opus/WebM (takes as long as the song). Resolves {blob, dur}. Errors: 'noenc' (no recorder), 'decode'. */
  async function toWebm(file,prog){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC||!window.MediaRecorder||!MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))throw new Error('noenc');
    const ac=new AC();try{await ac.resume()}catch(_){}
    const buf=await ac.decodeAudioData(await file.arrayBuffer()).catch(()=>{throw new Error('decode')});
    if(/webm/.test(file.type))return {blob:new Blob([file],{type:'video/webm'}),dur:buf.duration};
    const dest=ac.createMediaStreamDestination(),src=ac.createBufferSource();src.buffer=buf;src.connect(dest);
    const rec=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:128000}),parts=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};
    const stopped=new Promise(r=>rec.onstop=r),ended=new Promise(r=>src.onended=r);
    rec.start(1000);const t0=ac.currentTime;src.start();
    const iv=setInterval(()=>prog&&prog(Math.min(1,(ac.currentTime-t0)/buf.duration)),400);
    await ended;rec.stop();await stopped;clearInterval(iv);ac.close();
    return {blob:new Blob(parts,{type:'video/webm'}),dur:buf.duration};
  }

  /* read the saved config once: shared store when the viewer offers it, else this browser; never waits longer than `ms` */
  function load(ms){
    return new Promise(res=>{
      let done=false;const fin=c=>{if(!done){done=true;res(c||null)}};
      let local=null;try{local=JSON.parse(localStorage.getItem(LS_KEY)||'null')}catch(_){}
      const C=window.claude;
      if(!C||!C.use)return fin(local);
      setTimeout(()=>fin(local),ms||2500);
      C.use('db').then(db=>db?db.doc('site/config').get().then(s=>fin(s.exists?s.data():local)):fin(local)).catch(()=>fin(local));
    });
  }

  window.KSA_SITE_CONFIG={LS_KEY,EXPLORE_DEF,toWebm,DEFAULT_LOGO,logoUrl,audioUrl,textureSrc,applyIndices,applyBrand,load};
})();
