import {first,statement} from './db.mjs';
import {TERMS_VERSION,termsDocument} from '../public/terms.js';
export async function quote(db,userId,badge,level=null){
 const [family,owned,wallet]=await db.batch([statement(db,'SELECT * FROM bw_badges WHERE id=?',[badge]),statement(db,'SELECT level FROM bw_user_badges WHERE user_id=? AND badge=?',[userId,badge]),statement(db,'SELECT balance,frozen FROM bw_wallets WHERE user_id=?',[userId])]);
 const current=family.results[0];if(!current)throw Error('unknown_badge');
 const target=['genesis','quality'].includes(badge)?current.base:Math.max(current.base,current.level+1,level||0),prior=owned.results[0]?.level||0;
 return {level:target,previous:prior,cost:['genesis','quality'].includes(badge)?target:target-prior,balance:wallet.results[0]?.balance||0,frozen:Boolean(wallet.results[0]?.frozen)};
}
export async function settle(db,badge,input,id,env={}){
 if(input.accepted!==true||input.executionRequested!==true||input.withdrawalAcknowledged!==true||input.termsVersion!==TERMS_VERSION)throw Error('invalid_consent');
 const kind=input.kind||'claim',target=input.targetId||null,level=input.amount/100,holder=crypto.randomUUID(),locale=input.locale==='en'?'en':'es';
 const result=await db.batch([
  statement(db,'INSERT INTO bw_terms_documents(version,locale,document) VALUES(?,?,?) ON CONFLICT(version,locale) DO NOTHING',[TERMS_VERSION,locale,JSON.stringify(termsDocument(env,locale))]),
  statement(db,`INSERT INTO bw_actions(id,user_id,badge,kind,target_id,owner,level,cost,holder_id,terms_version,terms_locale,execution_requested,withdrawal_acknowledged)
   SELECT ?,?,?,?,?,?,?,CASE WHEN ?='support' OR ? IN('quality','genesis') THEN ? ELSE ?-coalesce((SELECT level FROM bw_user_badges WHERE user_id=? AND badge=?),0) END,
   coalesce((SELECT id FROM bw_user_badges WHERE user_id=? AND badge=?),?),?,?,1,1 WHERE NOT EXISTS(SELECT 1 FROM bw_actions WHERE id=?)`,[id,input.userId,badge.id,kind,target,input.owner,level,kind,badge.id,level,level,input.userId,badge.id,input.userId,badge.id,holder,TERMS_VERSION,locale,id]),
  statement(db,'SELECT * FROM bw_actions WHERE id=?',[id])
 ]);
 const action=result[2].results[0];
 if(!action||action.user_id!==input.userId||action.badge!==badge.id||action.kind!==kind||action.target_id!==target||action.owner!==input.owner||action.level!==level)throw Error('idempotency_conflict');
 return {id:action.id,badgeId:action.badge,holderId:kind==='support'?target:action.holder_id,cost:action.cost,level:action.level,balance:(await first(db,'SELECT balance FROM bw_wallets WHERE user_id=?',[input.userId])).balance,status:'accepted'};
}
