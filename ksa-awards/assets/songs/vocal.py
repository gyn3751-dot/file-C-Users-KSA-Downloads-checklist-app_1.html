"""Turn espeak-ng Korean syllables into sung notes with WORLD (pyworld): set pitch, stretch the vowel, lift formants."""
import numpy as np, pyworld as pw, esp
FP=5.0  # frame period ms
FORMANT=1.13   # >1 = brighter / more feminine timbre
def trim(x,th=.012):
    i=np.where(np.abs(x)>th)[0]
    return x[max(0,i[0]-60):i[-1]+60] if len(i) else x
def warp(sp,a):
    n=sp.shape[1]; src=np.arange(n)/a
    return np.array([np.interp(src,np.arange(n),row,right=row[-1]) for row in sp])
_cache={}
def analyse(syl):
    if syl in _cache: return _cache[syl]
    x,sr=esp.say(syl,rate=105,pitch=55); x=trim(x)
    f0,t=pw.harvest(x,sr,f0_floor=70,f0_ceil=500,frame_period=FP)
    sp=pw.cheaptrick(x,sr*1.0,f0,t) if False else pw.cheaptrick(x,f0,t,sr)
    ap=pw.d4c(x,f0,t,sr)
    _cache[syl]=(f0,sp,ap,sr); return _cache[syl]
def sing(syl,f,dur,prev=None,vib=True):
    f0,sp,ap,sr=analyse(syl)
    n=len(f0); T=max(4,int(dur*1000/FP))
    v=np.where(f0>0)[0]
    v0,v1=(v[0],v[-1]+1) if len(v) else (0,n)
    a=v0+int(.25*(v1-v0)); b=max(a+1,v0+int(.55*(v1-v0)))
    pre=np.arange(0,a); post=np.arange(b,n); mid_len=T-len(pre)-len(post)
    if mid_len<2: idx=np.linspace(0,n-1,T)
    else: idx=np.concatenate([pre,np.linspace(a,b-1,mid_len),post])
    ii=np.clip(np.round(idx).astype(int),0,n-1)
    voiced=f0[ii]>0
    sp2=sp[ii]; ap2=ap[ii]
    tt=np.arange(len(ii))*FP/1000
    ff=np.full(len(ii),f)
    if prev:  # short glide from the previous note
        g=np.clip(tt/0.05,0,1); ff=np.exp(np.log(prev)*(1-g)+np.log(f)*g)
    if vib and dur>0.45:
        depth=np.clip((tt-0.22)/0.25,0,1)*0.022
        ff=ff*(1+depth*np.sin(2*np.pi*5.4*tt))
    f02=np.where(voiced,ff,0.0)
    sp2=warp(sp2,FORMANT)
    y=pw.synthesize(f02,np.ascontiguousarray(sp2),np.ascontiguousarray(ap2),sr,FP)
    k=min(len(y)//4,int(.012*sr)); 
    if k>1: y[:k]*=np.linspace(0,1,k); y[-k:]*=np.linspace(1,0,k)
    return y,sr
def up(y,sr,SR):
    t=np.arange(int(len(y)*SR/sr))*sr/SR
    return np.interp(t,np.arange(len(y)),y)
def render(M,BEAT,BAR,hz,SR,L,R,add):
    track=np.zeros(len(L)); prev=None
    flat=[(b,nt,st,du,sy) for b,bar in enumerate(M) for (nt,st,du,sy) in bar]
    for k,(b,nt,st,du,sy) in enumerate(flat):
        f=hz(nt); t0=b*BAR+st*BEAT
        nxt=flat[k+1] if k+1<len(flat) else None
        gap=(nxt[0]*BAR+nxt[2]*BEAT-t0) if nxt else du*BEAT
        d=min(du*BEAT,gap)*0.96
        y,sr=sing(sy,f,d,prev if prev and abs(np.log(prev/f))<0.6 else None)
        y=up(y,sr,SR); i=int(t0*SR); j=min(len(track),i+len(y)); track[i:j]+=y[:j-i]
        prev=f
    track/=np.max(np.abs(track))+1e-9
    # gentle presence: a little high-shelf by adding the first difference
    pres=np.concatenate([[0],np.diff(track)]); track=track+0.25*pres
    track/=np.max(np.abs(track))+1e-9
    dl=int(.018*SR)
    dbl=np.concatenate([np.zeros(dl),track[:-dl]])
    L+=track*0.34+dbl*0.10; R+=track*0.34+dbl*0.13
