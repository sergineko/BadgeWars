export function validCheckout(input,catalog){
 const badge=catalog.find(b=>b.id===input?.badge);
 if(!badge||typeof input.owner!=='string'||!/^[A-Za-z0-9_]{2,24}$/.test(input.owner)||!Number.isSafeInteger(input.amount)||input.amount>100000000000||input.amount%100!==0)return false;
 const kind=input.kind||'claim';
 if(kind==='support')return badge.id==='quality'&&input.amount<=10000000&&input.amount>=100&&typeof input.targetId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.targetId);
 return kind==='claim'&&!input.targetId&&input.amount>=badge.base&&(!['genesis','quality'].includes(badge.id)||input.amount===badge.base);
}
export async function verifyChallenge(request,env,token,userId,action='wallet-topup'){
 if(!env.TURNSTILE_SECRET_KEY||typeof token!=='string'||token.length<10||token.length>2048)return false;
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',signal:AbortSignal.timeout(6000),body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||''})});
 const result=await response.json();
 // Official dummy keys return fixed test metadata, not the widget's action/cData.
 // Permit that documented behavior only on loopback in the explicit Sandbox.
 const localTest=env.DODO_PAYMENTS_ENVIRONMENT==='test_mode'&&['localhost','127.0.0.1','[::1]'].includes(new URL(env.APP_URL).hostname)&&new URL(request.url).origin===new URL(env.APP_URL).origin&&env.TURNSTILE_SITE_KEY==='1x00000000000000000000AA'&&env.TURNSTILE_SECRET_KEY==='1x0000000000000000000000000000000AA'&&token==='XXXX.DUMMY.TOKEN.XXXX';
 return result.success===true&&(localTest||result.hostname===new URL(env.APP_URL).hostname&&result.action===action&&result.cdata===userId);
}
