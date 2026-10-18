import {first,rows,run,statement} from './db.mjs';
import {publicProjection} from './inventory.mjs';
import {trustStateKey} from './trust-state.mjs';
export async function publish(db,env,id){
 if(!env.BADGES)return false;
 const token=crypto.randomUUID(),now=Date.now(),claimed=await statement(db,`UPDATE bw_badges SET lease_until=?,lease_token=? WHERE id=? AND dirty=1 AND lease_until<? AND published_at<? RETURNING id`,[now+120000,token,id,now,now-10000]).first();if(!claimed)return false;
 try{
  const day=new Date().toISOString().slice(0,10),budget=await statement(db,`INSERT INTO bw_kv_budget(day,writes) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET writes=writes+1 WHERE writes<900 RETURNING writes`,[day]).first();
  if(!budget)return false;
  const state={...await publicProjection(db,id),publishedAt:new Date().toISOString()};
  if(new TextEncoder().encode(JSON.stringify(state)).length>20000000)throw Error('projection_capacity');
  await env.BADGES.put(`badge:${id}`,JSON.stringify(state));
  const released=await statement(db,`UPDATE bw_badges SET published_revision=max(published_revision,?),published_at=?,dirty=CASE WHEN revision=? THEN 0 ELSE 1 END,lease_until=0,lease_token=NULL WHERE id=? AND lease_token=? RETURNING id`,[state.revision,now,state.revision,id,token]).first();
  if(!released)await run(db,'UPDATE bw_badges SET dirty=1 WHERE id=?',[id]);
  if(globalThis.caches){await caches.default.delete(new Request(new URL('/api/arena',env.APP_URL))).catch(()=>{});if(id==='quality')await caches.default.delete(trustStateKey(env.APP_URL)).catch(()=>{});}
  return true;
 }finally{await run(db,'UPDATE bw_badges SET lease_until=0,lease_token=NULL WHERE id=? AND lease_token=?',[id,token]);}
}
export async function publishDirty(db,env){for(const item of await rows(db,'SELECT id FROM bw_badges WHERE dirty=1 ORDER BY published_at LIMIT 5'))await publish(db,env,item.id);}
