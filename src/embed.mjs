import {catalog,escapeXml} from '../public/badges.js';
import {badgeUrl} from './badge-url.mjs';
import {first} from './db.mjs';
export async function personalEmbed(db,userId,holderId,appUrl,{style='',locale='en',format='md'}={}){
 const row=await first(db,`SELECT id,badge,owner FROM bw_user_badges WHERE id=? AND user_id=? AND status='active'`,[holderId,userId]);
 if(!row)return null;
 const badge=catalog.find(b=>b.id===row.badge),image=new URL(badgeUrl(row.badge,row.id,locale,style),appUrl),target=new URL(row.badge==='quality'?`/support/${row.id}`:`/badge/${row.badge}`,appUrl);
 const alt=`${badge.name} · @${row.owner}`;
 const code=format==='html'?`<a href="${escapeXml(target.href)}"><img src="${escapeXml(image.href)}" alt="${escapeXml(alt)}" /></a>`:`[![${alt}](${image.href})](${target.href})`;
 return {id:row.id,badgeId:row.badge,owner:row.owner,imageUrl:image.href,targetUrl:target.href,code};
}
