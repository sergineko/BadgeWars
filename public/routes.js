const badges=['flex','bait','funded','quality','genesis'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const rankingPath=(metric,badge='flex')=>'/leaderboard/'+(metric==='trust'||badge==='quality'?'trust':badges.includes(badge)?badge:'flex');
export function cleanHref(path='/',extra={}){
 const url=new URL(path,'https://badgewars.invalid');
 if(url.pathname==='/leaderboard')return url.hash==='#genesis-owners'?'/leaderboard/genesis':rankingPath(extra.metric,extra.badge);
 if(url.pathname==='/collection'&&extra.demo==='1')return '/collection/demo';
 return url.pathname.replace(/\/$/,'')||'/';
}
// Accept existing shared links, then remove query strings and fragments from the address bar.
export function routeState(value){
 const url=new URL(value),params=new URLSearchParams(url.search);let path=url.pathname.replace(/\/$/,'')||'/',scroll='';
 if(path==='/'&&url.hash==='#leaderboard')path='/leaderboard';
 if(path==='/leaderboard'&&(params.get('metric')==='trust'||params.get('badge')==='quality'))path='/leaderboard/trust';
 if(path==='/leaderboard'&&url.hash==='#genesis-owners')path='/leaderboard/genesis';
 if(path==='/leaderboard')path=rankingPath('bids',params.get('badge'));
 if(path==='/leaderboard/quality')path='/leaderboard/trust';
 if(path==='/collection'&&params.get('demo')==='1')path='/collection/demo';
 if(path==='/'&&badges.includes(params.get('badge')))path='/badge/'+params.get('badge');
 if(path==='/'&&uuid.test(params.get('support')||''))path='/support/'+params.get('support');
 if(path==='/'&&['#arena','#how'].includes(url.hash))scroll=url.hash.slice(1);
 const badge=path.match(/^\/badge\/([a-z]+)$/),support=path.match(/^\/support\/([^/]+)$/);
 if(badge&&badges.includes(badge[1]))params.set('badge',badge[1]);
 if(support&&uuid.test(support[1]))params.set('support',support[1]);
 if(path==='/collection/demo')params.set('demo','1');
 if(path==='/collection/sign-in-error')params.set('auth','error');
 const rankingBadge=path==='/leaderboard/trust'?'quality':path.match(/^\/leaderboard\/(flex|bait|funded|genesis)$/)?.[1];
 const page=rankingBadge?'/leaderboard':['/collection','/collection/demo','/collection/sign-in-error','/account/email'].includes(path)?'/collection':(badge&&badges.includes(badge[1])||support&&uuid.test(support[1]))?'/':path;
 return {path,page,params,scroll,rankingBadge,metric:rankingBadge==='quality'?'trust':'bids'};
}

// Only ordinary application pages use client navigation. Auth, payments and
// downloads keep their normal browser/server flow.
export function internalRoute(value,origin){
 try{
  const url=new URL(value,origin);
  if(url.origin!==new URL(origin).origin||!['https:','http:'].includes(url.protocol)||url.pathname.replace(/\/+$/,'')==='/account/email')return null;
  const route=routeState(url.href);
  return ['/','/leaderboard','/collection','/terms','/refunds','/privacy','/legal','/cookies'].includes(route.page)?route:null;
 }catch{return null;}
}
