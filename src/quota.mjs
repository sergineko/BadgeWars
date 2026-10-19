import {runtime,notifyOperations} from './operations.mjs';
export const quotaLimits={workerRequests:100000,d1RowsRead:5000000,d1RowsWritten:100000,kvReads:100000,kvWrites:1000,kvDeletes:1000,kvLists:1000,d1StorageBytes:5000000000,d1LargestDatabaseBytes:500000000,kvStorageBytes:1000000000};
export const quotaSignals=values=>Object.entries(quotaLimits).filter(([key,limit])=>Number.isFinite(values[key])&&values[key]>=limit*.8).map(([key,limit])=>({code:key,level:values[key]>=limit*.95?'critical':'warning',value:values[key],limit}));
export async function collectQuota(env,now=Date.now()){
 if(!/^[a-f0-9]{32}$/.test(env.CF_ACCOUNT_ID||'')||!env.CF_ANALYTICS_TOKEN)throw Error('analytics_not_configured');
 const day=new Date(now).toISOString().slice(0,10);
 const query=`query($account:string!,$day:Date!){viewer{accounts(filter:{accountTag:$account}){
 workersInvocationsAdaptive(limit:1000,filter:{date:$day}){sum{requests errors}dimensions{scriptName}}
 d1AnalyticsAdaptiveGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten}}
 kvOperationsAdaptiveGroups(limit:1000,filter:{date:$day}){sum{requests}dimensions{actionType}}
 d1StorageAdaptiveGroups(limit:1000,filter:{date:$day}){max{databaseSizeBytes}dimensions{databaseId}}
 kvStorageAdaptiveGroups(limit:1000,filter:{date:$day}){max{byteCount}dimensions{namespaceId}}
 }}}`;
 const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:'Bearer '+env.CF_ANALYTICS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{account:env.CF_ACCOUNT_ID,day}}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('analytics_unavailable');const result=await response.json();
 if(result.errors?.length||result.data?.viewer?.accounts?.length!==1)throw Error('analytics_unavailable');
 const account=result.data.viewer.accounts[0];
 if(!['workersInvocationsAdaptive','d1AnalyticsAdaptiveGroups','kvOperationsAdaptiveGroups'].every(k=>Array.isArray(account[k]))||account.workersInvocationsAdaptive.length===1000||account.kvOperationsAdaptiveGroups.length===1000)throw Error('analytics_unavailable');
 const values={workerRequests:account.workersInvocationsAdaptive.reduce((n,r)=>n+r.sum.requests,0),d1RowsRead:account.d1AnalyticsAdaptiveGroups.reduce((n,r)=>n+r.sum.rowsRead,0),d1RowsWritten:account.d1AnalyticsAdaptiveGroups.reduce((n,r)=>n+r.sum.rowsWritten,0),kvReads:0,kvWrites:0,kvDeletes:0,kvLists:0};
 for(const r of account.kvOperationsAdaptiveGroups){const key={read:'kvReads',write:'kvWrites',delete:'kvDeletes',list:'kvLists'}[r.dimensions.actionType];if(key)values[key]+=r.sum.requests;}
 if(Object.values(values).some(n=>!Number.isFinite(n)||n<0))throw Error('analytics_unavailable');
 if(!Array.isArray(account.d1StorageAdaptiveGroups)||!Array.isArray(account.kvStorageAdaptiveGroups)||account.d1StorageAdaptiveGroups.length===1000||account.kvStorageAdaptiveGroups.length===1000)throw Error('analytics_unavailable');
 values.d1StorageBytes=account.d1StorageAdaptiveGroups.reduce((n,r)=>n+r.max.databaseSizeBytes,0);values.d1LargestDatabaseBytes=Math.max(0,...account.d1StorageAdaptiveGroups.map(r=>r.max.databaseSizeBytes));values.kvStorageBytes=account.kvStorageAdaptiveGroups.reduce((n,r)=>n+r.max.byteCount,0);
 values.badgeWarsErrors=account.workersInvocationsAdaptive.filter(r=>r.dimensions?.scriptName==='badgewars').reduce((n,r)=>n+r.sum.errors,0);
 if(Object.values(values).some(n=>!Number.isFinite(n)||n<0))throw Error('analytics_unavailable');
 return {day,values};
}
export async function monitorQuota(db,env,now=Date.now()){
 const previous=await runtime(db,'quota');if(previous&&now-previous.updatedAt<3600000)return previous;
 try{const current=await collectQuota(env,now);await runtime(db,'quota',{...current,ok:true},now);await notifyOperations(db,env,'cuotas',[...quotaSignals(current.values),...(current.values.badgeWarsErrors>0?[{code:'worker_errors_today',level:'warning',value:current.values.badgeWarsErrors}]:[])],now);return current;}
 catch{await runtime(db,'quota',{ok:false},now);await notifyOperations(db,env,'cuotas',[{code:'quota_monitor_unavailable',level:'warning',value:1}],now);return null;}
}
