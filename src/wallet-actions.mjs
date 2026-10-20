import {first,statement} from './db.mjs';
import {TERMS_VERSION,termsDocument} from '../public/terms.js';
import {closeDueSeasons,currentSeason} from './seasons.mjs';
export async function quote(db,userId,badge,level=null){
 if(badge==='flex')await closeDueSeasons(db);
 const season=badge==='flex'?await currentSeason(db):null;
 const [family,owned,wallet]=await db.batch([statement(db,'SELECT * FROM bw_badges WHERE id=?',[badge]),statement(db,'SELECT level FROM bw_user_badges WHERE user_id=? AND badge=? AND season_id IS ?',[userId,badge,season?.id||null]),statement(db,'SELECT balance,frozen FROM bw_wallets WHERE user_id=?',[userId])]);
 const current=family.results[0];if(!current)throw Error('unknown_badge');
 const fixed=['genesis','quality','funded'].includes(badge),target=fixed?current.base:Math.max(current.base,current.level+1,level||0),prior=owned.results[0]?.level||0;
 return {level:target,previous:prior,cost:fixed?target:target-prior,balance:wallet.results[0]?.balance||0,frozen:Boolean(wallet.results[0]?.frozen),seasonId:season?.id||null,seasonClosed:badge==='flex'&&season?.status!=='open',alreadyOwned:fixed&&prior>0};
}
export async function settle(db,badge,input,id,env={}){
 if(input.accepted!==true||input.executionRequested!==true||input.withdrawalAcknowledged!==true||input.termsVersion!==TERMS_VERSION)throw Error('invalid_consent');
 const kind=input.kind||'claim',target=input.targetId||null,level=input.amount/100,holder=crypto.randomUUID(),locale=input.locale==='en'?'en':'es';
 if(badge.id==='flex')await closeDueSeasons(db);
 const priorAction=await first(db,'SELECT season_id,holder_id FROM bw_actions WHERE id=?',[id]);
 const previousSeason=priorAction?(priorAction.season_id||(await first(db,'SELECT season_id FROM bw_user_badges WHERE id=?',[priorAction.holder_id]))?.season_id):null;
 const seasonId=badge.id==='flex'?(input.seasonId||previousSeason||(await currentSeason(db))?.id):null;
 const result=await db.batch([
  statement(db,'INSERT INTO bw_terms_documents(version,locale,document) VALUES(?,?,?) ON CONFLICT(version,locale) DO NOTHING',[TERMS_VERSION,locale,JSON.stringify(termsDocument(env,locale))]),
  statement(db,`INSERT INTO bw_actions(id,user_id,badge,kind,target_id,owner,level,cost,holder_id,terms_version,terms_locale,execution_requested,withdrawal_acknowledged,season_id)
   SELECT ?,?,?,?,?,?,?,CASE WHEN ?='support' OR ? IN('quality','genesis','funded') THEN ? ELSE ?-coalesce((SELECT level FROM bw_user_badges WHERE user_id=? AND badge=? AND season_id IS ?),0) END,
   coalesce((SELECT id FROM bw_user_badges WHERE user_id=? AND badge=? AND season_id IS ?),?),?,?,1,1,? WHERE NOT EXISTS(SELECT 1 FROM bw_actions WHERE id=?)`,[id,input.userId,badge.id,kind,target,input.owner,level,kind,badge.id,level,level,input.userId,badge.id,seasonId,input.userId,badge.id,seasonId,holder,TERMS_VERSION,locale,seasonId,id]),
  statement(db,'SELECT * FROM bw_actions WHERE id=?',[id])
 ]);
 const action=result[2].results[0];
 if(!action||action.user_id!==input.userId||action.badge!==badge.id||action.kind!==kind||action.target_id!==target||action.owner!==input.owner||action.level!==level||(action.season_id||previousSeason||null)!==(seasonId||null))throw Error('idempotency_conflict');
 return {id:action.id,badgeId:action.badge,holderId:kind==='support'?target:action.holder_id,cost:action.cost,level:action.level,seasonId,balance:(await first(db,'SELECT balance FROM bw_wallets WHERE user_id=?',[input.userId])).balance,status:'accepted'};
}
