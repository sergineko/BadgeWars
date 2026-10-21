import {TERMS_VERSION} from './terms.js';
import {spendCredits} from './wallet.js';
import {pointsOf,formatPoints} from './points.js';
import {escapeXml as e} from './badges.js';
import {request,checkoutKey,forgetCheckout,paymentError} from './flow.js';
import {demoBag,demoSupporters,demoVisibility,demoArena} from './demo.js';
const $=s=>document.querySelector(s),validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'');
let generation=0;
export async function contributorsDialog(id,ctx,page=1){
 const turn=++generation,{t,price,svg,open}=ctx;open(`<h2>${t('viewSupporters')}</h2><p role="status">${t('loading')}</p>`);
 try{
  let bag;if(ctx.demo){if(id!==demoBag.id)throw Error();bag={...demoBag,supporters:demoSupporters,page:1,hasMore:false};}
  else{const response=await request(`/api/me/supporters?badge=${encodeURIComponent(id)}&page=${page}`);if(!response.ok)throw Error();bag=await response.json();}
  if(turn!==generation||ctx.isCurrent&&!ctx.isCurrent())return;
  open(`<div class="eyebrow">${t('privateArea')}</div><h2>${t('yourSupporters')}</h2><p>${t('privateListNote')}</p>${ctx.demo?`<p class="demo-notice">${t('demoCollectionNote')}</p>`:''}<div class="bag-stats"><strong>${t('pointsValue',{n:formatPoints(pointsOf(bag),ctx.locale)})}</strong><span>${t('supporterCount',{n:bag.supporterCount})}</span></div><div class="supporter-list">${bag.supporters.map((p,i)=>`<div class="supporter-row"><span class="supporter-position">${(bag.page-1)*20+i+1}</span><div><strong>@${e(p.alias)}</strong><small>${t('contributionsCount',{n:p.contributions})}</small></div><span>${t('pointsValue',{n:formatPoints(p.points,ctx.locale)})}</span></div>`).join('')||`<p>${t('noSupporters')}</p>`}</div><div class="supporter-pages">${page>1?`<button class="outline" id="supporters-prev">← ${t('previous')}</button>`:''}${bag.hasMore?`<button class="outline" id="supporters-next">${t('next')} →</button>`:''}</div><form id="visibility-form"><label for="visibility">${t('publicVisibility')}</label><select id="visibility" ${bag.status==='suspended'?'disabled':''}>${Array.from({length:6},(_,count)=>`<option value="${count}" ${bag.showTop===count?'selected':''}>${t(count?'publicTopSetting':'privateSetting',{n:count})}</option>`).join('')}</select><p>${t('visibilityNote')}</p><div id="visibility-preview">${svg('quality',bag)}</div><button class="primary" type="submit" ${bag.status==='suspended'?'disabled':''}>${t('saveVisibility')} ↗</button><p id="visibility-status" role="status"></p></form>`);
  $('#supporters-prev')?.addEventListener('click',()=>contributorsDialog(id,ctx,page-1));$('#supporters-next')?.addEventListener('click',()=>contributorsDialog(id,ctx,page+1));
  $('#visibility-form').onsubmit=async ev=>{
   ev.preventDefault();const button=ev.target.querySelector('button'),count=Number($('#visibility').value),status=$('#visibility-status');button.disabled=true;
   try{
    if(ctx.demo){demoVisibility(count);ctx.demoRefresh();bag={...bag,...demoBag};}
    else{const response=await request('/api/me/visibility',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({badge:id,count})});if(!response.ok)throw Error();Object.assign(bag,await response.json());await ctx.refresh();}
    status.className='success';status.textContent=t(ctx.demo?'visibilityDemoSaved':'visibilitySaved');
    $('#visibility-preview').innerHTML=svg('quality',bag);
   }catch{status.className='error';status.textContent=t('visibilityError');}finally{button.disabled=false;}
  };
 }catch{if(turn===generation&&(!ctx.isCurrent||ctx.isCurrent()))open(`<h2>${t('viewSupporters')}</h2><p class="error">${t('supportersError')}</p>`);}
}
export async function supportDialog(id,ctx){
 const turn=++generation,{t,price,svg,open}=ctx;open(`<h2>Trust Bag</h2><p role="status">${t('loading')}</p>`);
 try{
  if(!validId(id))throw Error();let bag;
  if(ctx.demo)bag=demoArena.states.quality.claims.find(p=>p.id===id);
  else{const response=await request('/api/support/target?badge='+encodeURIComponent(id));if(!response.ok)throw Error();bag=await response.json();}
  if(!bag)throw Error();if(turn!==generation||ctx.isCurrent&&!ctx.isCurrent())return;
  if(!ctx.demo&&ctx.user&&!ctx.user.alias){open(`<h2>${t('aliasRequiredTitle')}</h2><p>${t('aliasRequiredText')}</p><a class="primary" href="/collection">${t('collection')} ↗</a>`);return;}
  open(`<div class="eyebrow">${t('community')}</div><h2>${t('supportOwner',{owner:'@'+e(bag.owner)})}</h2>${svg('quality',bag)}<p>${t('supportTerms')}</p>${bag.topSupporters?.length?`<div class="public-supporters"><small>${t('topSupporters')}</small><p>${bag.topSupporters.slice(0,5).map(alias=>'@'+e(alias)).join(' · ')}</p></div>`:''}${ctx.demo?`<p class="demo-notice">${t('checkoutDemo')}</p>`:''}${!ctx.demo&&!ctx.user?`<button class="primary" id="support-login">${t('login')} ↗</button>`:`<form id="support-form"><label for="support-handle">${t('publicAlias')}</label><input id="support-handle" ${!ctx.demo?'readonly value="'+e(ctx.user?.alias||'')+'"':''} pattern="[A-Za-z0-9_]{2,24}" minlength="2" maxlength="24" required autocomplete="nickname">${!ctx.demo?'<p class="muted">'+t('aliasAccountManaged')+'</p>':''}<label for="support-amount">${t('supportAmount')}</label><input id="support-amount" type="number" min="1" max="100000" step="1" value="5" required><p id="support-points" class="support-points"></p><p>${t('contributorDisclosure')}</p><label class="wallet-consent"><input type="checkbox" id="support-consent" required><span>${t('spendConsent')} <a href="/terms" target="_blank" rel="noopener">${t('readTerms')}</a></span></label><label class="wallet-consent"><input type="checkbox" id="support-execution" required><span>${t('executionConsent')}</span></label><button class="primary" type="submit">${t(ctx.demo?'demoFlow':'spendCredits')} ↗</button><p id="support-status" role="status"></p></form>`}`);
  $('#support-login')?.addEventListener('click',()=>ctx.login(null,id));
  if($('#support-amount')){const update=()=>{$('#support-points').textContent=t('pointsToAdd',{n:formatPoints($('#support-amount').value,ctx.locale)});};$('#support-amount').oninput=update;update();}
  if($('#support-form'))$('#support-form').onsubmit=async ev=>{
   ev.preventDefault();const button=ev.target.querySelector('button'),status=$('#support-status');
   if(ctx.demo){status.className='success';status.textContent=t('supportDemo');return;}
   const input={badge:'quality',kind:'support',targetId:bag.id,owner:ctx.user.alias,amount:Math.round(Number($('#support-amount').value)*100),locale:ctx.locale,accepted:$('#support-consent').checked,executionRequested:$('#support-execution').checked,withdrawalAcknowledged:$('#support-execution').checked,termsVersion:TERMS_VERSION};button.disabled=true;status.textContent=t('preparing');
   await spendCredits(input,{...ctx,cost:input.amount/100},status,button);
  };
 }catch{if(turn===generation&&(!ctx.isCurrent||ctx.isCurrent()))open(`<h2>Trust Bag</h2><p class="error">${t('targetUnavailable')}</p>`);}
}
