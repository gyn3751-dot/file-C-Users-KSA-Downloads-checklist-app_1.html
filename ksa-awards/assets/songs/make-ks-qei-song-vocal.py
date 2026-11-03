import numpy as np, wave, sys
SR=44100; BPM=120; BEAT=60/BPM; BAR=4*BEAT
NOTE={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def hz(n):  # 'C#4'
    p=NOTE[n[0]]; i=1
    if n[i] in '#b': p+=1 if n[i]=='#' else -1; i+=1
    o=int(n[i:]); return 440*2**((p+12*(o+1)-69)/12)
# melody: per bar list of (note, start beat, dur beats)
# melody fitted one note per sung syllable: (note, start beat, dur beats, syllable)
M=[
 [('E4',0,.5,'반'),('E4',.5,.5,'짜'),('G4',1,.5,'기'),('G4',1.5,.5,'는'),('A4',2,.5,'하'),('G4',2.5,.5,'루'),('E4',3,1,'를')],
 [('D4',0,1,'채'),('E4',1,1,'우'),('D4',2,2,'는')],
 [('C4',0,.5,'고'),('C4',.5,.5,'개'),('E4',1,1,'게'),('A4',2,1,'진'),('G4',3,1,'짜')],
 [('F4',0,1,'목'),('A4',1,1,'쏘'),('G4',2,2,'리')],
 [('E4',0,.5,'써'),('G4',.5,.5,'보'),('C5',1,1,'고'),('B4',2,.5,'느'),('A4',2.5,.5,'껴'),('G4',3,1,'본')],
 [('B4',0,1,'그'),('A4',1,1,'대'),('G4',2,2,'로')],
 [('A4',0,.5,'품'),('A4',.5,.5,'질'),('A4',1,1,'로'),('G4',2,1,'다'),('F4',3,1,'팔')],
 [('B4',0,2,'게'),('D5',2,2,'요')],
 [('C5',0,1,'미'),('C5',1,.5,'드'),('A4',1.5,.5,'메'),('C5',2,1,'이'),('D5',3,1,'름')],
 [('D5',0,.5,'케'),('D5',.5,.5,'이'),('B4',1,.5,'에'),('G4',1.5,.5,'스'),('A4',2,.5,'큐'),('B4',2.5,.5,'이'),('C5',3,.5,'아'),('D5',3.5,.5,'이')],
 [('E5',0,.5,'고'),('D5',.5,.5,'개'),('B4',1,1,'기'),('B4',2,1,'고'),('E5',3,1,'른')],
 [('E5',0,.5,'품'),('E5',.5,.5,'질'),('D5',1,1,'이'),('C5',2,2,'뤼')],
 [('D5',0,.5,'한'),('C5',.5,.5,'국'),('A4',1,.5,'품'),('F4',1.5,.5,'질'),('A4',2,1,'만'),('C5',3,1,'족')],
 [('B4',0,2,'지'),('G4',2,2,'수')],
 [('E5',0,.75,'딩'),('C5',1,3,'동')],
]
CH=['C','G','Am','F','C','G','F','G','F','G','Em','Am','Dm','G','C']
CHN={'C':['C3','E3','G3','C4'],'G':['G2','D3','G3','B3'],'Am':['A2','E3','A3','C4'],'F':['F2','C3','F3','A3'],'Em':['E2','B2','E3','G3'],'Dm':['D3','A3','D4','F4']}
ROOT={'C':'C2','G':'G1','Am':'A1','F':'F1','Em':'E2','Dm':'D2'}
N=len(M); T=N*BAR+2.0
LEADG=float(__import__('os').environ.get('LEADG','.30'))
L=np.zeros(int(T*SR)); R=np.zeros_like(L)
def add(buf,sig,t,g=1.0):
    i=int(t*SR); j=min(len(buf),i+len(sig)); buf[i:j]+=sig[:j-i]*g
def env(n,a,d,s,r,sus):
    t=np.arange(n)/SR; e=np.ones(n)*s
    ai=int(a*SR); di=int(d*SR); e[:ai]=np.linspace(0,1,ai) if ai else e[:ai]
    e[ai:ai+di]=np.linspace(1,s,len(e[ai:ai+di]))
    si=int(sus*SR); 
    if si<n: e[si:]=e[min(si,n-1)]*np.exp(-(np.arange(n-si)/SR)/r)
    return e
def lead(f,dur):
    n=int((dur+0.35)*SR); t=np.arange(n)/SR
    vib=1+0.004*np.sin(2*np.pi*5.5*t)*np.clip(t*3,0,1)
    ph=2*np.pi*f*np.cumsum(vib)/SR
    s=np.sin(ph)+.45*np.sin(2*ph)+.22*np.sin(3*ph)+.1*np.sin(4*ph)+.05*np.sin(5*ph)
    return s*env(n,.012,.12,.6,.12,dur)
def bell(f,dur):
    n=int((dur+1.2)*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*f*t)*np.exp(-t*2.2)+.5*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*4)+.25*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*7)
    return s*np.minimum(1,t/0.003)
def pad(fs,dur):
    n=int((dur+.4)*SR); t=np.arange(n)/SR; s=np.zeros(n)
    for f in fs:
        for k,a in [(1,1),(2,.35),(3,.15)]:
            s+=a*np.sin(2*np.pi*f*k*t+np.random.rand()*6)*(1+.002*np.sin(2*np.pi*.7*t))
    return s/len(fs)*env(n,.25,.3,.8,.25,dur)
def bass(f,dur):
    n=int((dur+.1)*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*f*t)+.3*np.sin(4*np.pi*f*t)
    return s*env(n,.005,.15,.55,.06,dur)
def kick():
    n=int(.35*SR); t=np.arange(n)/SR; f=50+90*np.exp(-t*30)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)
rng=np.random.default_rng(3)
def snare():
    n=int(.22*SR); t=np.arange(n)/SR; w=rng.standard_normal(n); w=w-np.concatenate([[0],w[:-1]])*.6
    return (w*.5*np.exp(-t*18)+np.sin(2*np.pi*190*t)*np.exp(-t*25)*.6)
def hat():
    n=int(.06*SR); t=np.arange(n)/SR; w=rng.standard_normal(n); w=np.diff(np.concatenate([[0],w]))
    return w*np.exp(-t*70)*.35
for b in range(N):
    t0=b*BAR
    for (nt,st,du,_sy) in M[b]:
        s=lead(hz(nt),du*BEAT*.95); add(L,s,t0+st*BEAT,LEADG); add(R,s,t0+st*BEAT,LEADG)
        if b>=8: s2=bell(hz(nt)*2,du*BEAT); add(L,s2,t0+st*BEAT,.05); add(R,s2,t0+st*BEAT,.07)
    p=pad([hz(x) for x in CHN[CH[b]]],BAR); add(L,p,t0,.22*(1.25 if b>=8 else 1)); add(R,p,t0,.20*(1.25 if b>=8 else 1))
    last=b==N-1
    for beat in ([0] if last else [0,1.5,2,3.5]):
        bs=bass(hz(ROOT[CH[b]]),(2 if last else .45)*BEAT); add(L,bs,t0+beat*BEAT,.42); add(R,bs,t0+beat*BEAT,.42)
    if not last:
        for beat in [0,2] + ([2.5] if b%4==3 else []): add(L,kick(),t0+beat*BEAT,.55); add(R,kick(),t0+beat*BEAT,.55)
        for beat in [1,3]: sn=snare(); add(L,sn,t0+beat*BEAT,.15); add(R,sn,t0+beat*BEAT,.17)
        for k in range(8): h=hat(); add(L,h,t0+k*.5*BEAT,.09 if k%2 else .05); add(R,h,t0+k*.5*BEAT,.05 if k%2 else .09)
    else:
        add(L,kick(),t0,.6); add(R,kick(),t0,.6)
        for f,dt in [('E6',0),('C6',BEAT*1)]:   # "딩-동" chime
            s=bell(hz(f),2); add(L,s,t0+dt,.22); add(R,s,t0+dt,.22)
# intro sparkle swell
for k,f in enumerate(['C6','E6','G6','C7']):
    s=bell(hz(f),.3); add(L,s,0+k*0.06,.05); add(R,s,0+k*0.06,.05)
import os
if os.environ.get('VOCAL'):
    import vocal; vocal.render(M,BEAT,BAR,hz,SR,L,R,add)
# simple stereo reverb (feedback delays)
def verb(x,ds,fb):
    y=x.copy()
    for d in ds:
        n=int(d*SR); z=np.zeros_like(x)
        for i in range(1,6): 
            if n*i<len(x): z[n*i:]+=x[:-n*i]*(fb**i)
        y+=z/len(ds)
    return y
L=verb(L,[.029,.037,.044],.45); R=verb(R,[.031,.041,.047],.45)
st=np.stack([L,R],1); st/=np.max(np.abs(st))*1.12
fade=int(1.5*SR); st[-fade:]*=np.linspace(1,0,fade)[:,None]
pcm=(st*32767).astype('<i2')
with wave.open(sys.argv[1],'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('seconds',len(pcm)/SR)
