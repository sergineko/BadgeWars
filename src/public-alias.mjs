import {first,statement} from './db.mjs';

export const ALIAS_INTERVAL=14*24*60*60*1000;
export const normalizeAlias=value=>typeof value==='string'?value.trim().replace(/^@/,''):'';
export function aliasProfile(user,now=Date.now()){
 const changed=user.aliasChangedAt??null,next=changed===null?null:changed+ALIAS_INTERVAL;
 return {alias:user.alias||null,aliasChangedAt:changed,nextAliasChangeAt:next,canChangeAlias:next===null||now>=next};
}
export async function readAlias(db,userId){
 const user=await first(db,'SELECT public_alias AS alias,alias_changed_at*1000 AS aliasChangedAt FROM bw_users WHERE id=?',[userId]);
 return user?aliasProfile(user):null;
}
export async function changeAlias(db,userId,value){
 const alias=normalizeAlias(value);
 if(!/^[A-Za-z0-9_]{2,24}$/.test(alias))return {status:400,error:'alias_invalid'};
 if(/^bw_user_/i.test(alias))return {status:400,error:'alias_reserved'};
 const current=await readAlias(db,userId);if(!current)return {status:404,error:'not_found'};
 if(current.alias===alias)return {status:200,profile:current};
 if(!current.canChangeAlias)return {status:409,error:'alias_locked',profile:current};
 try{
  const row=await statement(db,`UPDATE bw_users SET public_alias=?,alias_changed_at=CAST(strftime('%s','now') AS INTEGER)
   WHERE id=? AND (alias_changed_at IS NULL OR alias_changed_at<=CAST(strftime('%s','now') AS INTEGER)-1209600)
   RETURNING public_alias AS alias,alias_changed_at*1000 AS aliasChangedAt`,[alias,userId]).first();
  if(!row)return {status:409,error:'alias_locked',profile:await readAlias(db,userId)};
  return {status:200,profile:aliasProfile(row)};
 }catch(error){
  if(/UNIQUE constraint failed: bw_users.public_alias/i.test(String(error.message)))return {status:409,error:'alias_taken'};
  if(String(error.message).includes('alias_locked'))return {status:409,error:'alias_locked',profile:await readAlias(db,userId)};
  throw error;
 }
}
