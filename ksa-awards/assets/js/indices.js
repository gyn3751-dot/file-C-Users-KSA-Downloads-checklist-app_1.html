/* 한국표준협회 지수 데이터 — index.html, explore.html 공용
 * homepage: 각 지수 공식 홈페이지 주소 (사이트 편집 패널에서도 바꿀 수 있습니다)
 */
(function(){
const HOME={
  qei:'https://ks-qei.ksa.or.kr/ks-qei/index.do',
  cqi:'https://ks-cqi.ksa.or.kr/ks-cqi/index.do',
  pbi:'https://ks-pbi.ksa.or.kr/ks-pbi/index.do',
  well:'https://wellness.ksa.or.kr/',
  dcxi:'https://www.ksa.or.kr/dcxi/index.do'
};
window.KSA_INDICES=[
  {id:'qei',color:'#F2C230',homepage:HOME.qei,code:'KS-QEI',name:'한국품질만족지수',en:'Korean Standard Quality Excellence Index',logo:'assets/logos/ks-qei.png',
   desc:'제품과 서비스를 실제 사용한 고객이 느끼는 품질 만족 수준을 측정합니다. 품질 요소별 성과와 전반적 만족도를 함께 평가해 업종별 품질 경쟁력을 보여줍니다.',
   target:'제조 · 서비스 전 업종',method:'고객 설문조사',announce:'10월',
   dims:[['품질 성능',35],['신뢰성',25],['디자인 · 사용성',20],['전반적 만족',20]]},
  {id:'cqi',color:'#E8392E',homepage:HOME.cqi,code:'KS-CQI',name:'콜센터품질지수',en:'Korean Standard Contact-center Quality Index',logo:'assets/logos/ks-cqi.png',
   desc:'고객이 콜센터를 이용하며 경험하는 서비스 품질을 측정합니다. 전문 평가원의 모니터링과 이용 고객 설문을 결합해 응대 품질과 문제 해결력을 평가합니다.',
   target:'콜센터 · 고객센터 운영 기관',method:'모니터링 + 고객 설문',announce:'6월',
   dims:[['문제 해결력',30],['응대 친절성',25],['접근 용이성',25],['고객 만족',20]]},
  {id:'pbi',color:'#EE5F2F',homepage:HOME.pbi,code:'KS-PBI',name:'프리미엄브랜드지수',en:'Korean Standard Premium Brand Index',logo:'assets/logos/ks-pbi.png',
   desc:'브랜드가 고객에게 주는 프리미엄 가치를 측정합니다. 브랜드 인지와 이미지, 품질 지각, 충성도를 종합해 업종별 대표 프리미엄 브랜드를 선정합니다.',
   target:'소비재 · 서비스 브랜드',method:'소비자 인식 조사',announce:'4월',
   dims:[['브랜드 인지',20],['브랜드 이미지',30],['지각된 품질',25],['브랜드 충성도',25]]},
  {id:'well',color:'#7DC245',homepage:HOME.well,code:'Wellness',name:'한국웰니스지수',en:'Korean Wellness Index',logo:'assets/logos/wellness.png',
   desc:'건강과 웰빙에 관련된 제품과 서비스가 고객의 신체적 · 정서적 웰니스에 기여하는 정도를 측정합니다. 웰니스 가치를 실현한 기업과 브랜드를 선정합니다.',
   target:'헬스케어 · 식품 · 레저 · 생활',method:'고객 설문 + 전문가 평가',announce:'11월',
   dims:[['신체 건강 기여',30],['정서적 안정',25],['안전 · 신뢰',25],['지속 가능성',20]]},
  {id:'dcxi',color:'#7B93F5',homepage:HOME.dcxi,code:'DCXI',name:'디지털고객경험지수',en:'Digital Customer Experience Index',logo:'assets/logos/dcxi.png',
   desc:'앱과 웹 등 디지털 채널에서 고객이 겪는 경험의 질을 측정합니다. 사용 편의성과 기능 완성도, 개인화, 보안 신뢰를 평가해 디지털 고객경험 수준을 진단합니다.',
   target:'앱 · 웹 서비스 운영 기업',method:'채널 진단 + 고객 설문',announce:'12월',
   dims:[['사용 편의성',30],['기능 완성도',25],['개인화',20],['보안 · 신뢰',25]]}
];
})();
