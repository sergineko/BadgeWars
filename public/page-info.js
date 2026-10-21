import {catalog} from './badges.js';
import {routeState} from './routes.js';
import {translate} from './i18n.js';

export const legalKeys={'/refunds':['refundEyebrow','refundTitle','refundIntro'],'/terms':['termsEyebrow','rules','termsIntro'],'/privacy':['privacyEyebrow','privacyTitle','privacyIntro'],'/legal':['legalEyebrow','legalTitle','legalIntro'],'/cookies':['cookiesEyebrow','cookiesTitle','cookiesIntro']};
export function pageInfo(path='/',locale='es'){
 const route=routeState(new URL(path,'https://badgewars.com').href),t=key=>translate(locale,key);
 const badge=catalog.find(b=>b.id===route.rankingBadge),legal=legalKeys[route.page];
 const title=legal?t(legal[1]):route.page==='/leaderboard'?`${badge?.name||t('ranking')} · ${t('ranking')}`:route.page==='/collection'?t('collection'):'Small badge. Big ego.';
 const description=t(legal?legal[2]:route.page==='/leaderboard'?'rankingSingleIntro':route.page==='/collection'?'collectionSingleIntro':'arenaIntro').replace(/<[^>]*>/g,'');
 const indexable=route.path==='/'||Boolean(legal)||Boolean(badge);
 return {title:`BadgeWars — ${title}`,description,canonical:'https://badgewars.com'+route.path,robots:indexable?'index,follow':'noindex,follow'};
}

export function updatePageInfo(path,locale){
 const info=pageInfo(path,locale);document.documentElement.lang=locale;document.title=info.title;
 for(const [selector,value,attribute] of [
  ['meta[name="description"]',info.description,'content'],['meta[name="robots"]',info.robots,'content'],
  ['link[rel="canonical"]',info.canonical,'href'],['meta[property="og:title"]',info.title,'content'],
  ['meta[property="og:description"]',info.description,'content'],['meta[property="og:url"]',info.canonical,'content'],
  ['meta[name="twitter:title"]',info.title,'content'],['meta[name="twitter:description"]',info.description,'content']
 ])document.querySelector(selector)?.setAttribute(attribute,value);
}
