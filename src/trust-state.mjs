// Shared metadata cache for all Trust Bag SVGs in one edge location.
// Each render is then cached by revision, so an old image cannot hide a newer rank.
export const trustStateKey=origin=>new Request(new URL('/__cache/trust-state-v5',origin));
export async function trustState(request,env,ctx){
 const key=trustStateKey(request.url),cached=await caches.default.match(key);
 if(cached)return cached.json();
 const state=await env.BADGES.get('badge:quality','json');if(!state)return null;
 const response=Response.json(state,{headers:{'Cache-Control':'public, max-age=0, s-maxage=10'}});
 ctx.waitUntil(caches.default.put(key,response));return state;
}
