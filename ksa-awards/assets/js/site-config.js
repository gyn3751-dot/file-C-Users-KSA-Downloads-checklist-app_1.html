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
  /* the image a canvas texture should be drawn from: an embedded data URI for the bundled logos (never taints) */
  function textureSrc(x){return x.logoCustom?x.logo:((window.KSA_LOGO_DATA||{})[x.id]||x.logo)}

  /* apply the per-index parts of a config (names, copy, weights, homepage, logo) to KSA_INDICES */
  function applyIndices(c){
    if(!c||typeof c!=='object')return;
    IDX.forEach(x=>{
      const o=c.indices&&c.indices[x.id];
      if(o&&typeof o==='object'){
        for(const k of ['name','en','desc','target','method','announce'])if(typeof o[k]==='string'&&o[k].trim())x[k]=o[k];
        const okDims=ds=>Array.isArray(ds)&&ds.length>=1&&ds.length<=12&&ds.every(d=>Array.isArray(d)&&typeof d[0]==='string'&&typeof d[1]==='number');
        const cp=ds=>ds.map(d=>[d[0],Math.max(0,Math.min(100,d[1]))]);
        if(Array.isArray(o.charts)&&o.charts.length&&o.charts.every(ch=>ch&&typeof ch.title==='string'&&okDims(ch.dims))){x.charts=o.charts.slice(0,6).map(ch=>({title:ch.title,inline:!!ch.inline,dims:cp(ch.dims)}));x.dims=cp(x.charts[0].dims)}
        else if(okDims(o.dims))x.dims=cp(o.dims);
      }
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

  window.KSA_SITE_CONFIG={LS_KEY,DEFAULT_LOGO,logoUrl,textureSrc,applyIndices,applyBrand,load};
})();
