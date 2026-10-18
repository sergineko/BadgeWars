import {scrypt,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const options={N:65536,r:8,p:2,maxmem:96*1024*1024};
const derive=(password,salt,pepper)=>new Promise((resolve,reject)=>scrypt(createHmac('sha256',pepper).update(password).digest(),salt,32,options,(error,key)=>error?reject(error):resolve(key)));
// One expensive hash per isolate at a time. Do not weaken the KDF for Workers Free.
let busy=false;
async function guarded(fn){if(busy)throw Error('rate_limited');busy=true;try{return await fn();}finally{busy=false;}}
export function validPassword(value){return typeof value==='string'&&[...value].length>=15&&[...value].length<=128&&!/^(.)\1+$/u.test(value)&&!['passwordpassword','123456789012345','qwertyuiopasdfgh','correct horse battery staple'].includes(value.toLowerCase());}
export async function passwordHash(value,pepper){return guarded(async()=>{const salt=randomBytes(32).toString('hex'),key=await derive(value,salt,pepper);return `scrypt-v1$${salt}$${key.toString('hex')}`;});}
export async function passwordVerify(value,encoded,pepper){return guarded(async()=>{const parts=String(encoded||'').split('$'),valid=parts[0]==='scrypt-v1'&&/^[a-f0-9]{64}$/.test(parts[1]||'')&&/^[a-f0-9]{64}$/.test(parts[2]||'');const key=await derive(typeof value==='string'?value:'',valid?parts[1]:'0'.repeat(64),pepper);return valid&&timingSafeEqual(key,Buffer.from(parts[2],'hex'));});}
