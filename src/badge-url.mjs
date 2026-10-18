import {uuid} from './collection.mjs';
export function badgeUrl(id,holder,locale='en',style=''){
 if(!['flex','bait','funded','quality','genesis'].includes(id)||!uuid(holder)||!['es','en'].includes(locale)||!['','compact'].includes(style))throw Error('Invalid badge URL');
 return `/badges/${id}/${holder}/${locale}${style==='compact'?'-compact':''}.svg`;
}
export function normalizedBadgeUrl(value){
 const url=new URL(value),match=url.pathname.match(/^\/badges\/([a-z]+)\/([^/]+)\/(es|en)(-compact)?\.svg$/);
 if(!match)return url;
 if(url.search)return null;
 url.pathname=`/badges/${match[1]}.svg`;url.searchParams.set('claim',match[2]);url.searchParams.set('lang',match[3]);if(match[4])url.searchParams.set('style','compact');
 return url;
}
