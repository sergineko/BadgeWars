import {comparePoints} from './points.js';
export function queryRanking(entries,{currency='credits',badge='all',metric='bids',search='',sort='highest',page=1,size=10}={}){
 const trust=metric==='trust';
 const sorted=entries.filter(p=>trust?p.badgeId==='quality':p.badgeId!=='quality'&&p.currency===currency&&(badge==='all'||p.badgeId===badge)).sort((a,b)=>(trust?comparePoints(a,b):b.amount-a.amount)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 let rows=sorted.map((p,i)=>({...p,position:i+1})).filter(p=>p.owner.toLowerCase().includes(search.trim().replace(/^@/,'').toLowerCase()));
 if(sort==='latest')rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));
 const total=rows.length,pages=Math.max(1,Math.ceil(total/size)),current=Math.min(pages,Math.max(1,Math.trunc(Number(page))||1));
 return {rows:rows.slice((current-1)*size,current*size),total,pages,page:current};
}
