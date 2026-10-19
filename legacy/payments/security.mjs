export async function verifyPolar(body,headers,secret,now=Date.now()){
 const id=headers.get('webhook-id'),stamp=headers.get('webhook-timestamp'),signatures=headers.get('webhook-signature');
 if(!id||id.length>200||!/^\d{10}$/.test(stamp||'')||Math.abs(now/1000-Number(stamp))>300||!signatures||!secret?.startsWith('whsec_'))return false;
 try{
  const bytes=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0));if(bytes.length<16)return false;
  const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const item of signatures.split(' ')){const [version,value]=item.split(',');if(version!=='v1'||!value)continue;try{if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(value),c=>c.charCodeAt(0)),new TextEncoder().encode(`${id}.${stamp}.${body}`)))return true;}catch{}}
 }catch{}return false;
}
