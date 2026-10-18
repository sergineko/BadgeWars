export function validCheckout(input,catalog){
 const badge=catalog.find(b=>b.id===input?.badge);
 if(!badge||typeof input.owner!=='string'||!/^[A-Za-z0-9_]{2,24}$/.test(input.owner)||!Number.isSafeInteger(input.amount)||input.amount>100000000000||input.amount%100!==0)return false;
 const kind=input.kind||'claim';
 if(kind==='support')return badge.id==='quality'&&input.amount<=10000000&&input.amount>=100&&typeof input.targetId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.targetId);
 return kind==='claim'&&!input.targetId&&input.amount>=badge.base&&(!['genesis','quality'].includes(badge.id)||input.amount===badge.base);
}
export async function verifyPolar(body,headers,secret,now=Date.now()){
 const id=headers.get('webhook-id'),stamp=headers.get('webhook-timestamp'),signatures=headers.get('webhook-signature');
 if(!id||id.length>200||!/^\d{10}$/.test(stamp||'')||Math.abs(now/1000-Number(stamp))>300||!signatures||!secret?.startsWith('whsec_'))return false;
 try{
  const bytes=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0));if(bytes.length<16)return false;
  const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const item of signatures.split(' ')){const [version,value]=item.split(',');if(version!=='v1'||!value)continue;try{if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(value),c=>c.charCodeAt(0)),new TextEncoder().encode(`${id}.${stamp}.${body}`)))return true;}catch{}}
 }catch{}return false;
}
export async function verifyChallenge(request,env,token,userId){
 if(!env.TURNSTILE_SECRET_KEY||typeof token!=='string'||token.length<10||token.length>2048)return false;
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',signal:AbortSignal.timeout(6000),body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||''})});
 const result=await response.json();
 // Official dummy keys return fixed test metadata, not the widget's action/cData.
 // Permit that documented behavior only on loopback in the explicit Sandbox.
 const localTest=env.POLAR_ENVIRONMENT==='sandbox'&&['localhost','127.0.0.1','[::1]'].includes(new URL(env.APP_URL).hostname)&&new URL(request.url).origin===new URL(env.APP_URL).origin&&env.TURNSTILE_SITE_KEY==='1x00000000000000000000AA'&&env.TURNSTILE_SECRET_KEY==='1x0000000000000000000000000000000AA'&&token==='XXXX.DUMMY.TOKEN.XXXX';
 return result.success===true&&(localTest||result.hostname===new URL(env.APP_URL).hostname&&result.action==='wallet-topup'&&result.cdata===userId);
}
