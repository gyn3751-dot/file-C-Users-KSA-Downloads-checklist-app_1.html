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
        if(Array.isArray(o.dims)&&o.dims.length===x.dims.length&&o.dims.every(d=>Array.isArray(d)&&typeof d[0]==='string'&&typeof d[1]==='number'))x.dims=o.dims.map(d=>[d[0],Math.max(0,Math.min(100,d[1]))]);
      }
      const h=c.homepages&&c.homepages[x.id];
      if(typeof h==='string'&&/^https?:\/\/\S+$/.test(h))x.homepage=h;
      const u=logoUrl(c.logos&&c.logos[x.id]);
      x.logo=u||DEFAULT_LOGO[x.id];x.logoCustom=!!u;
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

  window.KSA_SITE_CONFIG={LS_KEY,DEFAULT_LOGO,logoUrl,textureSrc,applyIndices,load};
})();
