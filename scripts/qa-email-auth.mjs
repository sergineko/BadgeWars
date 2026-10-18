// Fictional local accounts only. Start Wrangler without remote email bindings first.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {TERMS_VERSION} from '../public/terms.js';
const origin='http://127.0.0.1:8788',config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
assert.ok(config.send_email?.some(b=>b.name==='EMAIL'&&!b.remote),'Use the local email simulator, never a remote binding');
const email='qa-'+crypto.randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url'),replacement=randomBytes(24).toString('base64url');
async function call(operation,input){const r=await fetch(origin+'/api/auth/email/'+operation,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password,turnstileToken:'XXXX.DUMMY.TOKEN.XXXX',...input})});return {r,body:await r.json()};}
// Simulator message bodies intentionally include no private destination. For deterministic QA,
// locate only newly created files, then filter by the unpredictable registration code and kind.
async function latestCode(kind,since){const entries=await readdir('.wrangler/tmp/email',{recursive:true,withFileTypes:true});const {stat}=await import('node:fs/promises');let candidates=[];for(const entry of entries.filter(e=>e.isFile()&&e.name.endsWith('.txt'))){const path=join(entry.parentPath,entry.name),info=await stat(path);if(info.mtimeMs<since)continue;const value=await readFile(path,'utf8');const match=value.match(new RegExp('http://127\\.0\\.0\\.1:8788/account/email#'+kind+'/([a-f0-9]{64})'));if(match)candidates.push({time:info.mtimeMs,code:match[1]});}assert.equal(candidates.length,1,'Run this QA without another simultaneous email flow');return candidates[0].code;}
const started=Date.now(),registration=await call('register',{accepted:true,termsVersion:TERMS_VERSION,locale:'es'});assert.equal(registration.r.status,200);
const verifyCode=await latestCode('verifyEmail',started);assert.equal((await call('confirm',{code:verifyCode})).body.status,'confirmed');assert.equal((await call('confirm',{code:verifyCode})).body.error,'invalid_action_code');
const login=await call('login');assert.equal(login.body.status,'signed_in');const session=login.r.headers.get('Set-Cookie').split(';')[0];
const requested=Date.now();assert.equal((await call('reset',{locale:'en'})).body.status,'queued');const resetCode=await latestCode('resetPassword',requested);assert.equal((await call('password',{code:resetCode,password:replacement})).body.status,'password_changed');
const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie:session}})).json();assert.equal(me.user,null);
const result={registration:true,verification:true,replayRejected:true,signIn:true,passwordReset:true,previousSessionRevoked:true,emailDelivery:'local simulator only',codeLocation:'fragment excluded from HTTP URL'};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/email-native-qa.json',JSON.stringify(result,null,2));console.log(result);
