import {first,run,statement} from './db.mjs';
export async function recordIncident(db,kind,reference){
 await run(db,`INSERT INTO bw_operations(id,kind,reference,last_seen) VALUES(?,?,?,?) ON CONFLICT(kind,reference) DO UPDATE SET occurrences=occurrences+1,last_seen=excluded.last_seen`,[crypto.randomUUID(),kind,reference,Date.now()]);
}
export async function reviewIncident(db,id,state,actor,note,occurrence){
 if(!['open','acknowledged','resolved'].includes(state)||typeof actor!=='string'||actor.length<2||actor.length>120||typeof note!=='string'||note.length<8||note.length>1000||!Number.isSafeInteger(occurrence))throw Error('invalid_review');
 await run(db,'INSERT INTO bw_operation_events(id,operation_id,state,actor,note,occurrence) VALUES(?,?,?,?,?,?)',[crypto.randomUUID(),id,state,actor,note,occurrence]);
}
export async function runtime(db,key,value,now=Date.now()){
 if(value===undefined){const row=await first(db,'SELECT value,updated_at FROM bw_runtime WHERE key=?',[key]);return row?{...JSON.parse(row.value),updatedAt:row.updated_at}:null;}
 await run(db,'INSERT INTO bw_runtime(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',[key,JSON.stringify(value),now]);
}
export async function operationalStatus(db,now=Date.now()){
 const day=new Date(now).toISOString().slice(0,10),before=new Date(now-900000).toISOString();
 const queries=[
  ["SELECT count(*) n FROM bw_operations WHERE state IN('open','acknowledged')",[]],
  ["SELECT count(*) n FROM bw_webhooks WHERE state='review' OR (state IN('pending','processing') AND next_check<?)",[now-600000]],
  ["SELECT count(*) n FROM bw_topups WHERE state='review' OR (state='creating' AND created_at<?) OR (state='open' AND errors>=3)",[before]],
  ["SELECT count(*) n FROM bw_refund_requests WHERE state IN('review','submitted')",[]],
  ['SELECT count(*) n FROM bw_wallets WHERE frozen=1 OR debt>0',[]],
  ['SELECT count(*) n FROM bw_badges WHERE dirty=1 AND published_at<?',[now-900000]],
  ['SELECT coalesce((SELECT writes FROM bw_kv_budget WHERE day=?),0) n',[day]]
 ];
 const result=await db.batch(queries.map(([sql,args])=>statement(db,sql,args))),values=result.map(r=>r.results[0].n);
 return Object.fromEntries(['cases','webhooks','topups','refunds','wallets','projections','kvWrites'].map((k,i)=>[k,values[i]]));
}
export const operationSignals=s=>[
 ...['cases','webhooks','topups','refunds','wallets','projections'].filter(k=>s[k]>0).map(k=>({code:k,level:['cases','projections'].includes(k)?'warning':'critical',value:s[k]})),
 ...(s.kvWrites>=720?[{code:'kv_publication_budget',level:s.kvWrites>=855?'critical':'warning',value:s.kvWrites,limit:900}]:[])
];
// Only aggregate counts are sent, never user identities, payment bodies or tokens.
export async function notifyOperations(db,env,key,signals,now=Date.now()){
 if(!env.OPS_EMAIL||!env.OPS_EMAIL_TO||!env.OPS_EMAIL_FROM)return false;
 const fingerprint=JSON.stringify(signals.map(({code,level})=>[code,level]).sort()),token=crypto.randomUUID();
 await run(db,'INSERT INTO bw_alerts(key) VALUES(?) ON CONFLICT DO NOTHING',[key]);
 const claim=await statement(db,`UPDATE bw_alerts SET lease_until=?,lease_token=? WHERE key=? AND lease_until<? AND ((fingerprint<>? AND last_sent<?) OR (? AND last_sent<?)) AND (fingerprint<>'[]' OR ?<>'[]') RETURNING fingerprint`,[now+120000,token,key,now,fingerprint,now-600000,signals.length?1:0,now-86400000,fingerprint]).first();
 if(!claim)return false;
 try{
  const delivery=await env.OPS_EMAIL.send({from:env.OPS_EMAIL_FROM,to:env.OPS_EMAIL_TO,subject:`BadgeWars · ${signals.length?'revisión operativa':'servicio recuperado'} · ${key}`,text:[`BadgeWars / ${key} / ${new Date(now).toISOString()}`,signals.length?'Requiere revisión de SergioTech.es.':'La comprobación vuelve a estar correcta.',...signals.map(s=>`${s.level}: ${s.code} = ${s.value}${s.limit?' / '+s.limit:''}`),'Consultar el procedimiento del repositorio: docs/operations-runbook.md','No se han cambiado saldos ni realizado devoluciones automáticamente.'].join('\n')});
  await runtime(db,'mail:'+key,{accepted:true,messageId:delivery?.messageId||null},now);
  await run(db,'UPDATE bw_alerts SET fingerprint=?,last_sent=?,lease_until=0,lease_token=NULL WHERE key=? AND lease_token=?',[fingerprint,now,key,token]);return true;
 }catch(error){const code=/^E_[A-Z_]{1,80}$/.test(error.code||'')?error.code:'delivery_failed';await runtime(db,'mail:'+key,{accepted:false,code},now);console.error('BadgeWars operational email delivery failed',code);return false;}
 finally{await run(db,'UPDATE bw_alerts SET lease_until=0,lease_token=NULL WHERE key=? AND lease_token=?',[key,token]);}
}
export async function serviceHealth(env,now=Date.now()){
 try{
  const cron=await runtime(env.DB,'scheduler'),publisher=await runtime(env.DB,'publisher'),projection=await first(env.DB,'SELECT count(*) n FROM bw_badges WHERE dirty=1 AND published_at<?',[now-900000]);
  const cached=await env.BADGES?.get('badge:flex','stream');await cached?.cancel?.();
  const fresh=job=>Boolean(job?.finishedAt&&now-job.finishedAt<1200000&&!job.failed?.length);
  const checks={database:true,cache:Boolean(cached),scheduler:fresh(cron),publisher:fresh(publisher),projections:projection.n===0,maintenance:env.MAINTENANCE_MODE==='true'};
  const healthy=checks.cache&&checks.scheduler&&checks.publisher&&checks.projections&&!checks.maintenance;
  return Response.json({status:healthy?'ok':'degraded',checks},{status:healthy?200:503,headers:{'Cache-Control':'no-store','Retry-After':'300','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'300'}});}
}
