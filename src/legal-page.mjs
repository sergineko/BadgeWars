import {legalRoutes,legalSections} from '../public/legal.js';
import {TERMS_VERSION,operatorDetails,paymentSeller} from '../public/terms.js';
import {escapeXml as e} from '../public/badges.js';
const titles={'/terms':['Reglas y condiciones','Rules and terms'],'/refunds':['Política de reembolsos','Refund policy'],'/privacy':['Privacidad','Privacy'],'/legal':['Aviso legal','Legal notice'],'/cookies':['Cookies','Cookies']};
export function legalPageHtml(template,path,env={}){
 const owner=operatorDetails(env),nav=legalRoutes.map(route=>`<a href="${route}">${e(titles[route].join(' / '))}</a>`).join(' · ');
 const sections=locale=>legalSections(path,locale).map((s,i)=>`<section><h3>${i+1}. ${e(s.title)}</h3><p>${e(s.text)}</p></section>`).join('');
 const body=`<section class="page-heading"><h1>${e(titles[path].join(' / '))}</h1><p>BadgeWars · ${e(TERMS_VERSION)}</p></section><nav class="legal-nav">${nav}</nav><article class="terms-page"><section class="terms-operator"><h2>SergioTech.es / BadgeWars</h2><p>${e(owner.name)}<br>${e(owner.address)} · ${e(owner.country)}<br>NIF: ${e(owner.taxId)}<br><a href="mailto:${e(owner.email)}">${e(owner.email)}</a></p><p>Merchant of Record: ${e(paymentSeller.name)} · <a href="${e(paymentSeller.terms)}">Buyer terms</a> · <a href="${e(paymentSeller.privacy)}">Privacy</a></p></section><div class="terms-content" lang="es"><h2>Español</h2>${sections('es')}</div><div class="terms-content" lang="en"><h2>English</h2>${sections('en')}</div></article>`;
 return template.replace(/<title>.*?<\/title>/,`<title>${e(titles[path][0])} — BadgeWars</title>`).replace(/<main>[\s\S]*?<\/main>/,`<main>${body}</main>`).replace('<header></header>','<header><a class="brand" href="/">BadgeWars</a></header>').replace(/<footer>[\s\S]*?<\/footer>/,`<footer><a href="/">BadgeWars</a><nav>${nav}</nav></footer>`);
}
export async function legalPage(request,env){
 const path=new URL(request.url).pathname;if(!legalRoutes.includes(path))return null;
 const template=await (await env.ASSETS.fetch(new Request(new URL('/index.html',request.url)))).text();
 return new Response(request.method==='HEAD'?null:legalPageHtml(template,path,env),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
