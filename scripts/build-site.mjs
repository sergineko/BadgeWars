import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {headerHtml,homeHtml,avatarHtml,rankingHtml,pageHeadingHtml,signInGateHtml} from '../public/home.js';
import {footerHtml} from '../public/footer.js';
import {translate} from '../public/i18n.js';
import {badgeSvg,money,escapeXml as e} from '../public/badges.js';
import {cleanHref,routeState} from '../public/routes.js';
import {pageInfo,legalKeys} from '../public/page-info.js';

// Render public shells at build time. Never embed accounts, purchases or stale live ranks.
const t=(key,values)=>translate('es',key,values),data={demo:false,states:{},rankings:[]};
const state=id=>data.states[id]||{amount:0,claims:[]},href=cleanHref;
let illustration=0;
const staticSvg=(id,state,compact=false)=>badgeSvg(id,state,compact,'es').replace(/bw-(?:flex|bait|funded|quality|genesis)-[a-f0-9]{8}/g,`bw-static-${id}-${++illustration}`);
const context={data,t,state,href,arenaLoaded:false,arenaError:false,filter:'all',showSeasons:()=>false,
 svg:staticSvg,price:(n,c)=>money(n,c,'es'),avatar:r=>avatarHtml(r),
 seasonBanner:()=>'',next:()=>0,flexSeason:()=>null,publicationNote:()=>'',pageHeading:(...keys)=>pageHeadingHtml(t,href,...keys)};
const template=await readFile('templates/page.html','utf8');
const routes=['/','/leaderboard/flex','/leaderboard/bait','/leaderboard/funded','/leaderboard/trust','/leaderboard/genesis','/collection'];
for(const path of routes){
 const route=routeState('https://badgewars.com'+path),info=pageInfo(path);
 let main=route.page==='/'?homeHtml(context):route.page==='/leaderboard'?rankingHtml({...context,rankingQuery:{badge:route.rankingBadge,metric:route.metric,search:'',sort:'highest'}}):pageHeadingHtml(t,href,'collectionEyebrow','collectionTitle','collectionSingleIntro')+`<section class="collection-page">${signInGateHtml(t,href)}</section>`;
 if(route.page==='/leaderboard')main=main.replace('<div id="ranking-results"></div>',`<div id="ranking-results" aria-live="polite"><p class="empty-state">${t('unknown')}</p></div>`);
 const content={...Object.fromEntries(Object.entries(info).map(([key,value])=>[key,e(value)])),main,header:headerHtml({page:route.page,locale:'es',user:null,t,href}),footer:footerHtml(t,href('/'),legalKeys)};
 const html=template.replace(/\{\{(\w+)\}\}/g,(_,key)=>content[key]);
 const file=path==='/'?'public/index.html':`public${path}/index.html`;await mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true});await writeFile(file,html);
}
const files=['fonts/fonts.css','style.css','points.css','modern.css','legal.css','ranking.css','navigation.css','footer.css','icons.css','performance.css','alias.css'];
const css=await Promise.all(files.map(async file=>`/* ${file} */\n`+(await readFile('public/'+file,'utf8')).replace(/@import url\('\/fonts\/fonts.css'\);\s*/,'')));
await writeFile('public/site.css',css.join('\n'));
await writeFile('public/.well-known/ai-catalog.json',await readFile('public/.well-known/ard.json'));
console.log(`Built ${routes.length} public pages and one stylesheet.`);
