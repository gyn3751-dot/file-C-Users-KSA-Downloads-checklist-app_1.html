import pandas as pd, openpyxl, copy
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
W='/tmp/w/'
d25=pd.read_excel(W+'a25.xlsx',sheet_name='사업정리본_이관사업제거')
d26=pd.read_excel(W+'a26.xlsx',sheet_name='Sheet1',dtype={'기간/연도':str}); d26=d26[d26['사업범주 3(목) 내역'].notna()].copy()
d25['cat']=d25['예산(목)'].replace({'서비스지수':'지수','조찬':'경영자조찬회','현장교육(OJT)':'OJT'})
d25['rev']=d25['매출계'];d25['cost']=d25['사업비기타'];d25['ev']=d25.iloc[:,7];d25['m']=d25['월'].astype(int)
d26['cat']=d26['사업범주 3(목) 내역'];d26['rev']=d26['매출계'];d26['cost']=d26['사업비 기타'];d26['ev']=d26['내역'];d26['m']=d26['전기일'].dt.month
CATS=['공개교육','사내교육','OJT','자격교육','포럼및세미나','해외공개연수','포상','해외위탁연수','경영자조찬회','일반연구','지수']
def agg(d,months):
    x=d[d.m.isin(months)].groupby('cat')[['rev','cost']].sum().reindex(CATS)
    return x
Y26=agg(d26,range(1,11)); Y25=agg(d25,range(1,11))
M26_10=agg(d26,[10]);M26_9=agg(d26,[9]);M25_10=agg(d25,[10])
def norm(s): 
    import re
    return re.sub(r'(20)?\d\d년?','',re.sub(r'\s+','',str(s)))
def drivers(da,db,cat,months_a,months_b,n=2):
    a=da[(da.cat==cat)&da.m.isin(months_a)].assign(k=lambda x:x.ev.map(norm)).groupby('k')[['rev','cost']].sum()
    b=db[(db.cat==cat)&db.m.isin(months_b)].assign(k=lambda x:x.ev.map(norm)).groupby('k')[['rev','cost']].sum()
    j=b.join(a,how='outer',lsuffix='b',rsuffix='a').fillna(0); j['dr']=j.revb-j.reva
    j=j.reindex(j.dr.abs().sort_values(ascending=False).index).head(n)
    return [(k,r.dr) for k,r in j.iterrows() if abs(r.dr)>=1e7]
wb=openpyxl.load_workbook(W+'in.xlsx'); ws=wb.worksheets[0]
ws.title='매출실적개별현황리포트_10월누계'
n=lambda v:0 if pd.isna(v) else float(v)
for i,c in enumerate(CATS):
    r=5+i; p=21+i
    assert ws.cell(r,1).value.lstrip('-')==c or (c=='지수'), (ws.cell(r,1).value,c)
    ws.cell(r,3).value=n(Y26.rev[c]); ws.cell(r,4).value=n(Y26.cost[c]) if not pd.isna(Y26.cost[c]) and Y26.cost[c]!=0 else None
    ws.cell(r,5).value=f'=C{r}-D{r}'
    ws.cell(p,2).value=n(Y25.rev[c]); ws.cell(p,3).value=n(Y25.cost[c]) if n(Y25.cost[c])!=0 else None
for c in (3,4):
    pass
t26r,t26c=Y26.rev.sum(),Y26.cost.sum(); t25r,t25c=Y25.rev.sum(),Y25.cost.sum()
tgt={c:ws.cell(5+i,2).value for i,c in enumerate(CATS)}; T=sum(tgt.values())
e=lambda v:f'{v/1e8:+.1f}억'
def sg(v): return f'{v/1e8:+.1f}억'
prof26=t26r-t26c; prof25=t25r-t25c
# 목표 대비 / 전년 대비 사업군별
dt={c:n(Y26.rev[c])-tgt[c] for c in CATS}
dy={c:n(Y26.rev[c])-n(Y25.rev[c]) for c in CATS}
dp={c:(n(Y26.rev[c])-n(Y26.cost[c]))-(n(Y25.rev[c])-n(Y25.cost[c])) for c in CATS}
top=lambda d,k=3,neg=None:[ (c,v) for c,v in sorted(d.items(),key=lambda x:-abs(x[1])) if (neg is None or (v<0)==neg)][:k]
def fmt(lst): return ', '.join(f'{c}({sg(v)})' for c,v in lst)
dtot=t26r-T
ev_f=drivers(d25,d26,'포럼및세미나',range(1,11),range(1,11),1)
txt=f"""KSA 대시보드 작성 (1~10月 누계, 원천: 2025·2026 사업군별 매출·사업비 RAW)

1. 26년도 목표 대비 실적 분석
• 매출 {t26r/1e8:.1f}억 / 목표 {T/1e8:.1f}억 → 목표 대비 {sg(dtot)} (달성률 {t26r/T*100:.1f}%)
 - 미달: {fmt(top(dt,4,True))}
 - 초과: {fmt(top(dt,3,False))}
• 사업비 {t26c/1e8:.1f}억, 이익1 {prof26/1e8:.1f}억 (이익률 {prof26/t26r*100:.1f}%)
 ※ 이익1 목표는 RAW에 없어 목표 대비 이익은 산출하지 않음(기존 대시보드 '+2.1억'은 목표 원본 확인 필요)

2. 전년 동기(1~10月) 대비 실적 분석
• 매출 {sg(t26r-t25r)} ({(t26r/t25r-1)*100:+.1f}%) : 2025 {t25r/1e8:.1f}억 → 2026 {t26r/1e8:.1f}억
 - 감소: {fmt(top(dy,3,True))}
 - 증가: {fmt(top(dy,3,False))}
• 이익1 {sg(prof26-prof25)} ({(prof26/prof25-1)*100:+.1f}%) : 2025 {prof25/1e8:.1f}억 → 2026 {prof26/1e8:.1f}억
 - 증가: {fmt(top(dp,3,False))}
 - 감소: {fmt(top(dp,2,True))}
• 이익률 {prof25/t25r*100:.1f}% → {prof26/t26r*100:.1f}% ({(prof26/t26r-prof25/t25r)*100:+.1f}%p)

3. 데이터 확인 사항
• 기존 템플릿의 2025 비교값(매출 74.4억)은 1~12月 성격으로 보여 RAW(1~10月 필터) {t25r/1e8:.1f}억으로 교체함
• 지수 매출은 2025 {n(Y25.rev['지수'])/1e8:.1f}억 → 2026 {n(Y26.rev['지수'])/1e8:.1f}억 ({sg(dy['지수'])}): PBI·WEI 등 연도별 수행 항목 차이 확인 필요
• 연간 추정(73.6억/42.4억/31.6억)은 RAW에 없어 기존 값 유지(확인 필요)"""
ws['Q2'].value=txt
ws['A2'].value='2026 목표 매출&실적 1~10月'
ws['A18'].value='2025 매출&사업비 1~10月 (RAW 1~10月 필터, 인문경영 제외)'
ws['A33'].value='전년대비 매출&이익1 참고자료 (1~10월 기준): 2025·2026 사업군별 매출·사업비(10월) RAW 집계'
ws['A35'].value='※ 사업군 코드 통일: 서비스지수→지수, 조찬→경영자조찬회, 현장교육(OJT)→OJT. 2025는 월(1~10), 2026은 전기일 월(1~10) 기준. 2026 RAW 말미 "총 액" 합계행은 제외하여 이중집계 방지.'
def fnotes(lst): return '\n'.join(f'-{c} {sg(v)}' for c,v in lst)
ws['I4'].value='26년 매출 목표 대비 차이 ('+sg(dtot)+')\n\n'+fnotes(top(dt,5))
ws['L4'].value='26년 이익1 전년대비 ('+sg(prof26-prof25)+')\n\n'+fnotes(top(dp,5))
ws['E20'].value='RAW 재집계(1~10月)로 갱신됨.\n전년대비 수치는 RAW 기준.'
ws['I20'].value='전년대비 매출 ('+sg(t26r-t25r)+')\n\n'+fnotes(top(dy,5))
ws['L20'].value='전년대비 이익1 ('+sg(prof26-prof25)+')\n\n'+fnotes(top(dp,5))

# ---------- 월 분석 시트
ms=wb.create_sheet('사업군별_10월분석',0)
hdr=Font(bold=True); thin=Side(style='thin',color='999999'); bd=Border(left=thin,right=thin,top=thin,bottom=thin)
fill=PatternFill('solid',fgColor='FFC0C0C0'); fill2=PatternFill('solid',fgColor='FFFFCC99')
ms['A1']='2026년 10월 사업군별 매출·이익1 분석 (단월)'; ms['A1'].font=Font(bold=True,size=14)
ms['A2']='이익1 = 매출 − 사업비기타 | 전월 대비 = 2026.9월 | 전년 동월 대비 = 2025.10월 | 단위: 원'
heads=['사업군','매출','이익1','이익률','전월 대비\n매출 증감액','전월 대비\n매출 증감률','전월 대비\n이익1 증감액','전월 대비\n이익1 증감률','전년 동월 대비\n매출 증감액','전년 동월 대비\n매출 증감률','전년 동월 대비\n이익1 증감액','전년 동월 대비\n이익1 증감률','비고']
for j,h in enumerate(heads,1):
    c=ms.cell(4,j,h); c.font=hdr; c.fill=fill; c.alignment=Alignment(wrap_text=True,horizontal='center',vertical='center'); c.border=bd
ms.row_dimensions[4].height=34
# 데이터 시트
ds=wb.create_sheet('집계데이터')
dh=['사업군','2026.10 매출','2026.10 사업비','2026.9 매출','2026.9 사업비','2025.10 매출','2025.10 사업비','2026 1~10 매출','2026 1~10 사업비','2025 1~10 매출','2025 1~10 사업비']
for j,h in enumerate(dh,1): ds.cell(1,j,h).font=hdr
srcs=[M26_10,M26_9,M25_10,Y26,Y25]
for i,c in enumerate(CATS):
    ds.cell(2+i,1,c)
    for k,s in enumerate(srcs):
        ds.cell(2+i,2+2*k,n(s.rev[c])); ds.cell(2+i,3+2*k,n(s.cost[c]))
    for j in range(2,12): ds.cell(2+i,j).number_format='#,##0'
ds.column_dimensions['A'].width=14
for j in range(2,12): ds.column_dimensions[L(j)].width=18
nrow=len(CATS); tr=2+nrow
ds.cell(tr,1,'합계').font=hdr
for j in range(2,12): ds.cell(tr,j,f'=SUM({L(j)}2:{L(j)}{tr-1})').number_format='#,##0'
tot_dm=(M26_10.rev.sum()-M26_9.rev.sum()); tot_dy=(M26_10.rev.sum()-M25_10.rev.sum())
def pd_(a,b): return None if b in (0,None) or pd.isna(b) else (a-b)/abs(b)
notes={}
for i,c in enumerate(CATS):
    r10,c10=n(M26_10.rev[c]),n(M26_10.cost[c]); r9,c9=n(M26_9.rev[c]),n(M26_9.cost[c]); ry,cy=n(M25_10.rev[c]),n(M25_10.cost[c])
    nt=[]
    if r10==0 and c10==0 and r9==0 and ry==0: nt.append('해당 월 실적·전년 데이터 없음(값 비어 있음)')
    else:
        if r10<0: nt.append('매출 음수(취소·환불) → 이익률·증감률 해석 주의')
        if r10==0 and c10>0: nt.append('매출 없이 사업비만 발생')
        if r10>0 and c10==0: nt.append('사업비 미발생(값 비어 있음)')
        if r9==0 and (r10 or c10): nt.append('전월 값 없음 → 증감률 산출불가')
        if ry==0 and cy==0 and (r10 or c10): nt.append('전년 동월 값 없음 → 증감률 산출불가')
        sh=abs(r10-r9)/abs(tot_dm) if tot_dm else 0; shy=abs(r10-ry)/abs(tot_dy) if tot_dy else 0
        if abs(r10-r9)>=3e7 and sh>=0.2:
            dv=drivers(d26,d26,c,[10],[9]) if False else None
            a=d26[(d26.cat==c)&(d26.m==9)].assign(k=lambda x:x.ev.map(norm)).groupby('k').rev.sum(); b=d26[(d26.cat==c)&(d26.m==10)].assign(k=lambda x:x.ev.map(norm)).groupby('k').rev.sum()
            j=b.sub(a,fill_value=0); j=j.reindex(j.abs().sort_values(ascending=False).index).head(2)
            nt.append('[전월 영향] '+', '.join(f'{k} {v/1e6:+,.0f}백만' for k,v in j.items() if abs(v)>=1e7))
        if abs(r10-ry)>=3e7 and shy>=0.2:
            a=d25[(d25.cat==c)&(d25.m==10)].assign(k=lambda x:x.ev.map(norm)).groupby('k').rev.sum(); b=d26[(d26.cat==c)&(d26.m==10)].assign(k=lambda x:x.ev.map(norm)).groupby('k').rev.sum()
            j=b.sub(a,fill_value=0); j=j.reindex(j.abs().sort_values(ascending=False).index).head(2)
            nt.append('[전년 영향] '+', '.join(f'{k} {v/1e6:+,.0f}백만' for k,v in j.items() if abs(v)>=1e7))
    notes[c]='; '.join(nt)
def put(r,src,label):
    ms.cell(r,1,label)
    # B 매출 C 이익1 D 이익률 ; ds columns: B,C 26.10 ; D,E 26.9 ; F,G 25.10
    ms.cell(r,2,f"=集计".replace('集计',f"集计"))
for i,c in enumerate(CATS+['총계']):
    r=5+i; s=2+i
    ms.cell(r,1,c if c!='총계' else '총 계 (COSD제외)')
    ms.cell(r,2,f"=집계데이터!B{s}")
    ms.cell(r,3,f"=집계데이터!B{s}-집계데이터!C{s}")
    ms.cell(r,4,f'=IF(B{r}=0,"-",C{r}/B{r})')
    p_rev=f"집계데이터!D{s}"; p_pr=f"(집계데이터!D{s}-집계데이터!E{s})"
    y_rev=f"집계데이터!F{s}"; y_pr=f"(집계데이터!F{s}-집계데이터!G{s})"
    ms.cell(r,5,f"=B{r}-{p_rev}"); ms.cell(r,6,f'=IF({p_rev}=0,"-",E{r}/ABS({p_rev}))')
    ms.cell(r,7,f"=C{r}-{p_pr}"); ms.cell(r,8,f'=IF({p_pr}=0,"-",G{r}/ABS({p_pr}))')
    ms.cell(r,9,f"=B{r}-{y_rev}"); ms.cell(r,10,f'=IF({y_rev}=0,"-",I{r}/ABS({y_rev}))')
    ms.cell(r,11,f"=C{r}-{y_pr}"); ms.cell(r,12,f'=IF({y_pr}=0,"-",K{r}/ABS({y_pr}))')
    ms.cell(r,13,notes.get(c,''))
    for j in range(1,14):
        cc=ms.cell(r,j); cc.border=bd
        if j in (2,3,5,7,9,11): cc.number_format='#,##0;[Red]-#,##0'
        if j in (4,6,8,10,12): cc.number_format='0.0%;[Red]-0.0%'
        if j==13: cc.alignment=Alignment(wrap_text=True,vertical='top')
        if c=='총계': cc.font=hdr; cc.fill=fill2
ms.column_dimensions['A'].width=18
for j in range(2,13): ms.column_dimensions[L(j)].width=15
ms.column_dimensions['M'].width=70
ms.freeze_panes='B5'
# 누계 요약 하단
r0=5+len(CATS)+3
ms.cell(r0,1,'1~10월 누계 (참고)').font=hdr
for j,h in enumerate(['사업군','매출','이익1','이익률','전년 동기 매출','전년 동기 이익1','매출 증감액','매출 증감률','이익1 증감액','이익1 증감률'],1):
    c=ms.cell(r0+1,j,h); c.font=hdr; c.fill=fill; c.border=bd; c.alignment=Alignment(wrap_text=True,horizontal='center')
for i,c in enumerate(CATS+['총계']):
    r=r0+2+i; s=2+i
    ms.cell(r,1,c if c!='총계' else '총 계 (COSD제외)')
    ms.cell(r,2,f"=집계데이터!H{s}"); ms.cell(r,3,f"=집계데이터!H{s}-집계데이터!I{s}")
    ms.cell(r,4,f'=IF(B{r}=0,"-",C{r}/B{r})')
    ms.cell(r,5,f"=집계데이터!J{s}"); ms.cell(r,6,f"=집계데이터!J{s}-집계데이터!K{s}")
    ms.cell(r,7,f"=B{r}-E{r}"); ms.cell(r,8,f'=IF(E{r}=0,"-",G{r}/ABS(E{r}))')
    ms.cell(r,9,f"=C{r}-F{r}"); ms.cell(r,10,f'=IF(F{r}=0,"-",I{r}/ABS(F{r}))')
    for j in range(1,11):
        cc=ms.cell(r,j); cc.border=bd
        if j in (2,3,5,6,7,9): cc.number_format='#,##0;[Red]-#,##0'
        if j in (4,8,10): cc.number_format='0.0%;[Red]-0.0%'
        if c=='총계': cc.font=hdr; cc.fill=fill2
import os
os.makedirs('/tmp/w/out',exist_ok=True)
wb.save('/tmp/w/out/result.xlsx')
print(txt)
for c in CATS: print(c,notes[c])
