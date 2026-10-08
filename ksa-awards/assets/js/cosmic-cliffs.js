/* 행성 보드 배경 — 용골자리 성운 '우주 절벽(Cosmic Cliffs)'의 재해석
 * 사진을 쓰지 않고 캔버스에 직접 그립니다: 청록빛 성운 하늘, 주황·갈색 가스 절벽과 빛나는 능선,
 * 능선 위로 피어오르는 먼지 기둥, 6갈래 회절 빛살을 가진 별(JWST 사진의 특징).
 */
(function(){
  'use strict';
  const board=document.querySelector('.hero-board');if(!board)return;
  const cv=document.createElement('canvas');cv.className='nebula';cv.setAttribute('aria-hidden','true');
  board.insertBefore(cv,board.firstChild);

  /* deterministic value noise so every visit sees the same landscape */
  function hash(x,y){let h=(Math.imul(x,374761393)+Math.imul(y,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
  function vn(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
  function fbm(x,y,o){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vn(x*f,y*f);n+=a;f*=2.07;a*=.5}return s/n}
  const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
  const mix=(a,b,t)=>a+(b-a)*t;

  function render(){
    const rect=board.getBoundingClientRect();
    const W=Math.max(320,Math.min(1100,Math.round(rect.width))),H=Math.max(240,Math.round(W*rect.height/rect.width));
    cv.width=W;cv.height=H;
    const g=cv.getContext('2d'),img=g.createImageData(W,H),d=img.data;
    /* the cliff's top edge: a low rolling base, tall pillars, fine crenellation */
    const ridge=new Float32Array(W);
    /* towering spires like the Webb image: a few broad massifs and narrow peaks over a rolling base */
    const PEAKS=[[.08,.20,.06],[.19,.30,.045],[.27,.16,.03],[.41,.24,.05],[.55,.12,.025],[.66,.33,.055],[.74,.18,.03],[.86,.26,.05],[.95,.14,.035]];
    const wide=Math.min(2.2,Math.max(1,(H/W)/.59)); /* narrow boards (phones) get broader massifs */
    for(let x=0;x<W;x++){const u=x/W;
      let lift=.06*fbm(u*3+1.3,2.1,5);
      for(const [c,h,w] of PEAKS){const z=(u-c)/(w*wide);lift+=h*Math.exp(-z*z)*(.75+.5*fbm(u*9+c*20,3.3,4))}
      const crenel=Math.pow(Math.max(0,fbm(u*34+7,4.4,3)-.4)*1.7,1.5);
      ridge[x]=H*(.8+.03*Math.sin(u*2.6+.8))-H*lift/Math.sqrt(wide)-H*.05*crenel;}
    for(let y=0;y<H;y++){const v=y/H;
      for(let x=0;x<W;x++){const u=x/W,i=(y*W+x)*4,ry=ridge[x];
        let r,gg,b;
        if(y<ry){
          /* sky: deep blue at the top, teal clouds, warm haze just above the cliffs */
          const t=v/(ry/H);
          r=mix(6,22,t);gg=mix(14,58,t);b=mix(34,96,t);
          const cl=fbm(u*2.6+.4,v*3.2+.2,6),cl2=fbm(u*7+3,v*7+1,4);
          const cloud=sm(.42,.78,cl)*(.55+.45*cl2);
          r+=40*cloud;gg+=110*cloud;b+=150*cloud;
          const lift=Math.max(0,(ry-y)/H);
          const haze=Math.exp(-lift/.10);
          r+=150*haze;gg+=82*haze;b+=40*haze;
          /* dust columns rising off the ridge */
          const wisp=sm(.5,.85,fbm(u*14+2,v*3.2-.4,5))*Math.exp(-lift/.16);
          r+=120*wisp;gg+=86*wisp;b+=62*wisp;
          /* faint red emission high up */
          const em=sm(.6,.9,fbm(u*3.4+9,v*2.4+4,5))*(1-t)*.6;
          r+=70*em;gg+=10*em;b+=30*em;
        }else{
          /* cliff body: glowing orange edge into deep brown, sculpted by noise */
          const depth=(y-ry)/H,tex=fbm(u*9+1,v*11+2,6),tex2=fbm(u*30,v*30,3);
          const k=sm(0,.22,depth);
          r=mix(232,96,k);gg=mix(146,42,k);b=mix(78,20,k);
          const shade=.55+.75*tex+.18*(tex2-.5);
          r*=shade;gg*=shade;b*=shade;
          const rim=Math.exp(-depth/.012);
          r+=(255-r)*rim*.75;gg+=(212-gg)*rim*.7;b+=(160-b)*rim*.55;
          const fade=sm(.12,.42,depth);
          r=mix(r,18,fade);gg=mix(gg,8,fade);b=mix(b,6,fade);
        }
        /* keep the header and legend readable */
        const vign=Math.max(sm(.22,0,v)*.55,sm(.8,1,v)*.65);
        r*=1-vign;gg*=1-vign;b*=1-vign;
        d[i]=r;d[i+1]=gg;d[i+2]=b;d[i+3]=255;
      }}
    g.putImageData(img,0,0);
    /* stars: a dusting, then a few bright ones with JWST's six-point diffraction spikes */
    let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    for(let n=0;n<W*H/900;n++){const x=rnd()*W,y=rnd()*H,ab=y<ridge[Math.min(W-1,x|0)];const a=(ab?.35:.12)+rnd()*.5;
      g.fillStyle=`rgba(${220+rnd()*35|0},${215+rnd()*40|0},255,${a})`;g.fillRect(x,y,rnd()<.15?1.6:1,rnd()<.15?1.6:1)}
    const spike=(x,y,len,col)=>{g.save();g.translate(x,y);g.globalCompositeOperation='lighter';
      const halo=g.createRadialGradient(0,0,0,0,0,len*.35);halo.addColorStop(0,col.replace('A','.95'));halo.addColorStop(.25,col.replace('A','.35'));halo.addColorStop(1,col.replace('A','0'));
      g.fillStyle=halo;g.beginPath();g.arc(0,0,len*.35,0,7);g.fill();
      [[Math.PI/2,1],[Math.PI/6,1],[-Math.PI/6,1],[0,.38]].forEach(([a,s])=>{g.save();g.rotate(a);const L=len*s,lg=g.createLinearGradient(-L,0,L,0);
        lg.addColorStop(0,col.replace('A','0'));lg.addColorStop(.5,col.replace('A','.85'));lg.addColorStop(1,col.replace('A','0'));g.fillStyle=lg;g.fillRect(-L,-.7,L*2,1.4);g.restore()});
      g.restore()};
    const bright=[[.12,.18,'rgba(255,236,214,A)'],[.31,.42,'rgba(200,225,255,A)'],[.58,.12,'rgba(255,220,200,A)'],[.83,.3,'rgba(255,240,230,A)'],[.71,.52,'rgba(190,215,255,A)'],[.46,.24,'rgba(255,250,240,A)'],[.93,.08,'rgba(214,232,255,A)']];
    bright.forEach(([u,v,c],k)=>spike(u*W,v*H,(k%3===0?34:22)*W/1100+10,c));
  }

  let lastW=0,t=0;
  const go=()=>{const w=board.clientWidth;if(Math.abs(w-lastW)<lastW*.12&&lastW)return;lastW=w;render();board.classList.add('nebula-on')};
  new ResizeObserver(()=>{clearTimeout(t);t=setTimeout(go,180)}).observe(board);
  go();
})();
