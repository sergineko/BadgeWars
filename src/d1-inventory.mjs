import {first,rows,statement} from './db.mjs';
import {closeDueSeasons,seasons} from './seasons.mjs';
const joins=`JOIN bw_users a ON a.id=u.user_id LEFT JOIN bw_flex_seasons s ON s.id=u.season_id LEFT JOIN bw_flex_results f ON f.holder_id=u.id`;
const fields=`u.id,u.status,u.badge AS badgeId,u.owner,u.level*100 AS amount,'credits' AS currency,u.edition,u.created_at,u.updated_at,a.avatar_url AS avatarUrl,u.show_top AS showTop,u.points,u.supporter_count AS supporterCount,s.id AS seasonId,s.number AS seasonNumber,s.design AS seasonDesign,s.status AS seasonStatus,s.ends_at AS seasonEndsAt,CASE WHEN u.badge='flex' THEN (SELECT count(*)>1 FROM bw_flex_seasons) ELSE 0 END AS showSeason`;
const rank=`CASE WHEN u.status<>'active' OR u.badge IN('genesis','funded') THEN NULL WHEN s.status='closed' THEN f.rank ELSE (SELECT count(*)+1 FROM bw_user_badges r WHERE r.badge=u.badge AND r.season_id IS u.season_id AND r.status='active' AND
 (CASE WHEN u.badge='quality' THEN length(r.points)>length(u.points) OR (length(r.points)=length(u.points) AND r.points>u.points) OR (r.points=u.points AND (r.created_at,r.id)<(u.created_at,u.id))
 ELSE r.level>u.level OR (r.level=u.level AND (r.updated_at,r.id)<(u.updated_at,u.id)) END)) END`;
const topAliases=`coalesce((SELECT json_group_array(alias) FROM (SELECT alias,row_number() OVER(ORDER BY length(points) DESC,points DESC,created_at,user_id) AS n FROM bw_contributors WHERE holder_id=u.id) WHERE n<=u.show_top),'[]')`;
const projectionRank=`CASE WHEN u.badge IN('genesis','funded') THEN NULL WHEN s.status='closed' THEN f.rank ELSE row_number() OVER(PARTITION BY u.badge,u.season_id ORDER BY CASE WHEN u.badge='quality' THEN length(u.points) ELSE u.level END DESC,CASE WHEN u.badge='quality' THEN u.points END DESC,CASE WHEN u.badge='quality' THEN u.created_at ELSE u.updated_at END,u.id) END`;
function clean(row){const {public_top,...value}=row;value.topSupporters=JSON.parse(public_top||'[]');return value;}
export async function inventory(db,userId){
 await closeDueSeasons(db);
 const items=await rows(db,`SELECT ${fields},${rank} AS rank,${topAliases} AS public_top FROM bw_user_badges u ${joins} WHERE u.user_id=? ORDER BY u.badge,s.number DESC`,[userId]);
 return {items:items.map(clean),nextCursor:null};
}
export async function inventoryEntry(db,id){return first(db,`SELECT ${fields},${rank} AS rank,w.frozen,w.debt FROM bw_user_badges u ${joins} JOIN bw_wallets w ON w.user_id=u.user_id WHERE u.id=?`,[id]);}
export async function privateSupporters(db,userId,id,page=1){
 const holder=await first(db,`SELECT ${fields},${rank} AS rank,${topAliases} AS public_top FROM bw_user_badges u ${joins} WHERE u.id=? AND u.user_id=? AND u.badge='quality'`,[id,userId]);if(!holder)return null;
 const current=Math.max(1,Math.min(1000000,Math.trunc(Number(page))||1));
 const supporters=await rows(db,`SELECT alias,points,contributions,last_at FROM bw_contributors WHERE holder_id=? ORDER BY length(points) DESC,points DESC,created_at,user_id LIMIT 21 OFFSET ?`,[id,(current-1)*20]);
 return {...clean(holder),supporters:supporters.slice(0,20),page:current,hasMore:supporters.length>20};
}
export async function setVisibility(db,userId,id,count){
 if(!Number.isInteger(count)||count<0||count>5)throw Error('invalid_visibility');
 const result=await db.batch([statement(db,`UPDATE bw_user_badges SET show_top=? WHERE id=? AND user_id=? AND badge='quality' AND status='active' RETURNING id`,[count,id,userId]),statement(db,`UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id='quality' AND EXISTS(SELECT 1 FROM bw_user_badges WHERE id=? AND user_id=? AND badge='quality' AND status='active')`,[id,userId])]);
 return result[0].results.length>0;
}
export async function publicProjection(db,id){
 if(id==='flex')await closeDueSeasons(db);
 const result=await db.batch([statement(db,'SELECT * FROM bw_badges WHERE id=?',[id]),statement(db,`SELECT ${fields},${projectionRank} AS rank,${topAliases} AS public_top FROM bw_user_badges u ${joins} WHERE u.badge=? AND u.status='active' ORDER BY s.number DESC,CASE WHEN u.badge='quality' THEN length(u.points) ELSE u.level END DESC,CASE WHEN u.badge='quality' THEN u.points END DESC,CASE WHEN u.badge IN('quality','funded') THEN u.created_at ELSE u.updated_at END,u.id`,[id])]);
 const b=result[0].results[0],entries=result[1].results.map(row=>({...publicEntry(clean(row)),aliases:[]})),allSeasons=id==='flex'?await seasons(db):[],season=allSeasons[0],leader=entries.find(p=>id!=='flex'||p.seasonId===season?.id);
 return {owner:['quality','genesis','funded'].includes(id)?null:leader?.owner||null,amount:leader?.amount||0,sold:b.sold,revision:b.revision,entries,...(id==='flex'?{rank:leader?.rank,showSeason:allSeasons.length>1,seasons:allSeasons,season,seasonId:season.id,seasonNumber:season.number,seasonDesign:season.design,seasonStatus:season.status}:{} )};
}
export function publicEntry(entry){const {showTop,user_id,aliases,status,frozen,debt,...value}=entry;if(['quality','funded'].includes(value.badgeId)){delete value.amount;delete value.currency;}if(['funded','genesis'].includes(value.badgeId))delete value.rank;return value;}
export async function syncAvatar(db,userId,avatar){
 await db.batch([statement(db,`UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id IN(SELECT u.badge FROM bw_user_badges u JOIN bw_users a ON a.id=u.user_id WHERE a.id=? AND a.avatar_url IS NOT ?)`,[userId,avatar]),statement(db,'UPDATE bw_users SET avatar_url=? WHERE id=?',[avatar,userId])]);
}
