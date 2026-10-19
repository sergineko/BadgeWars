import {catalog,escapeXml} from '../public/badges.js';
import {badgeUrl} from './badge-url.mjs';
import {first} from './db.mjs';
import {resilientEmbed} from '../public/embed-fallback.js';
export async function personalEmbed(db,userId,holderId,appUrl,{style='',locale='en',format='md'}={}){
 const row=await first(db,`SELECT b.id,b.badge,b.owner FROM bw_user_badges b JOIN bw_wallets w ON w.user_id=b.user_id WHERE b.id=? AND b.user_id=? AND b.status='active' AND w.frozen=0 AND w.debt=0`,[holderId,userId]);
 if(!row)return null;
 const badge=catalog.find(b=>b.id===row.badge),image=new URL(badgeUrl(row.badge,row.id,locale,style),appUrl),target=new URL(`/b/${row.id}`,appUrl);
 const alt=`${badge.name} · @${row.owner}`;
 const code=format==='html-safe'?resilientEmbed(image.href,target.href,alt,locale,style==='compact'):format==='html'?`<a href="${escapeXml(target.href)}"><img src="${escapeXml(image.href)}" alt="${escapeXml(alt)}" /></a>`:`[![${alt}](${image.href})](${target.href})`;
 return {id:row.id,badgeId:row.badge,owner:row.owner,imageUrl:image.href,targetUrl:target.href,code};
}
