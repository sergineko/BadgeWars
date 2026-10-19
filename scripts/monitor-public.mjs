import assert from 'node:assert/strict';
const origin='https://badgewars.com';
async function check(){
 const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(12000)});assert.equal(health.status,200,'Health endpoint must be healthy');assert.equal((await health.json()).status,'ok');
 const arena=await fetch(origin+'/api/arena',{signal:AbortSignal.timeout(12000)});assert.equal(arena.status,200,'Public arena unavailable');const state=await arena.json();assert.equal(state.demo,false,'Production must not serve demo data');
 for(const badge of ['flex','quality','genesis']){assert.ok(state.states[badge],'Missing badge projection');const r=await fetch(origin+'/badges/'+badge+'.svg',{signal:AbortSignal.timeout(12000)});assert.equal(r.status,200,badge+' SVG unavailable');assert.ok(r.headers.get('Content-Type')?.startsWith('image/svg+xml'));assert.ok((await r.text()).includes('<svg'));}
}
try{await check();}catch{console.log('Initial availability check failed; retrying once.');await new Promise(resolve=>setTimeout(resolve,2000));await check();}
console.log('BadgeWars: scheduler, D1, public projections and SVG endpoints healthy.');
