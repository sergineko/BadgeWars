export function normalizePoints(value='0'){
 const text=String(value);return /^\d+$/.test(text)?text.replace(/^0+(?=\d)/,''):'0';
}
export function pointsOf(state={}){
 if(state.points!==undefined)return normalizePoints(state.points);
 // Read old, bounded KV projections during migration. New projections contain points only.
 const cents=String(state.supportTotal??0);return /^\d+$/.test(cents)?String(BigInt(cents)/100n):'0';
}
export const formatPoints=(value,locale='en')=>new Intl.NumberFormat(locale==='es'?'es-ES':'en-US',{useGrouping:'always',maximumFractionDigits:0}).format(BigInt(normalizePoints(value)));
export function shortPoints(value,locale='en'){
 const text=normalizePoints(value);return text.length<=15?formatPoints(text,locale):`≈ ${text[0]}${locale==='es'?',':'.'}${text.slice(1,4)} ×10^${text.length-1}`;
}
export function comparePoints(a,b){const x=BigInt(pointsOf(a)),y=BigInt(pointsOf(b));return x===y?0:x>y?-1:1;}
export function trustTier(state={}){
 if(!state.owner)return {id:'preview',color:'#6dcafa',label:'trustPreview',stamp:'trustNew'};
 if(pointsOf(state)==='0')return {id:'unproven',color:'#939eae',label:'trustUnproven',stamp:'trustNew'};
 const rank=Number(state.rank);
 if(rank===1)return {id:'leader',color:'#f0cc7c',label:'trustLeader',stamp:'trustFirst'};
 if(rank>=2&&rank<=3)return {id:'podium',color:'#c4a3ff',label:'trustPodium',stamp:'trustTop3'};
 if(rank>=4&&rank<=10)return {id:'established',color:'#72dcc1',label:'trustEstablished',stamp:'trustTop10'};
 return {id:'rising',color:'#77bce9',label:'trustRising',stamp:'trustClimbing'};
}
