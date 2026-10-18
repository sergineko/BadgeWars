import {TERMS_VERSION} from './terms.js';
import {escapeXml as e} from './badges.js';
import {request,checkoutKey,forgetCheckout,paymentError} from './flow.js';
export const demoWallet={balance:15,frozen:false,debt:0,termsVersion:TERMS_VERSION,environment:'sandbox',paymentsAvailable:false};
export const walletStrip=(wallet,t,demo=false)=>`<div class="wallet-strip"><div><small>${t('walletTitle')}${demo?' · DEMO':''}</small><strong>${Number(wallet?.balance||0).toLocaleString()} BC</strong><p>${t(wallet?.frozen?'walletFrozen':'walletRate')}</p></div><div class="wallet-tools">${demo?'':`<button class="text-link" data-action="refund-request">${t('refundRequestTitle')}</button>`}<button class="outline" data-action="billing-portal">${t('billingPortal')} ↗</button><button class="primary" data-action="wallet">${t('topup')} ↗</button></div></div>`;
let turnstileScript;
export async function turnstile(){
 if(window.turnstile)return window.turnstile;
 if(!turnstileScript)turnstileScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>resolve(window.turnstile);script.onerror=()=>{turnstileScript=null;reject(Error('challenge_unavailable'));};document.head.appendChild(script);});
 return turnstileScript;
}
export async function walletDialog(ctx,needed=0){
 const {t,open,user,demo,locale}=ctx;
 if(!user&&!demo){ctx.login();return;}
 let wallet=demo?demoWallet:ctx.wallet;
 if(!demo){try{const response=await request('/api/me/wallet');if(!response.ok)throw Error();wallet=await response.json();}catch{open(`<h2>${t('walletTitle')}</h2><p class="error">${t('walletUnavailable')}</p>`);return;}}
 if(ctx.isCurrent&&!ctx.isCurrent())return;
 const min=Math.max(5,Math.ceil(needed-(wallet.balance||0))),enabled=demo||wallet.paymentsAvailable&&!wallet.frozen;
 open(`<div class="eyebrow">BADGEWARS / CREDITS</div><h2>${t('walletTitle')}</h2><div class="bag-stats"><strong>${wallet.balance} BC</strong><span>${t('availableCredits')}</span></div><p>${t('walletRate')}</p>${needed?`<p class="support-points">${t('creditsNeeded',{n:needed})}</p>`:''}${wallet.environment==='sandbox'?`<p class="demo-notice">${t(demo?'walletDemo':'walletSandbox')}</p>`:''}${!enabled?`<p class="error">${t(wallet.frozen?'walletFrozen':'paymentsSetup')}</p>`:''}
 <form id="topup-form"><label for="topup-amount">${t('topupAmount')}</label><input id="topup-amount" type="number" min="5" max="100000" step="1" value="${min}" required><div class="topup-presets">${[5,15,50].map(n=>`<button type="button" data-credit-preset="${n}">${n} BC</button>`).join('')}</div><label for="topup-currency">${t('currency')}</label><select id="topup-currency"><option value="usd">USD · $</option><option value="eur">EUR · €</option></select><p>${t('walletTax')}</p><label class="wallet-consent"><input type="checkbox" id="topup-consent" required><span>${t('walletConsent')}</span></label><label class="wallet-consent"><input type="checkbox" id="topup-immediate" required><span>${t('walletImmediate')}</span></label><label class="wallet-consent"><input type="checkbox" id="topup-adult" required><span>${t('walletAdult')}</span></label><p><a class="text-link" href="/terms" target="_blank" rel="noopener">${t('readTerms')} ↗</a></p><p>${t('walletRefundPolicy')}</p><div id="wallet-challenge"></div><button class="primary" type="submit" ${!enabled?'disabled':''}>${t(demo?'demoFlow':'topupPolar')} ↗</button><p id="topup-status" role="status"></p></form>`);
 const $=s=>document.querySelector(s);let token='',widget=null;
 document.querySelectorAll('[data-credit-preset]').forEach(button=>button.onclick=()=>{$('#topup-amount').value=button.dataset.creditPreset;});
 if(!demo&&enabled){try{const ts=await turnstile();if(!$('#wallet-challenge'))return;widget=ts.render('#wallet-challenge',{sitekey:ctx.turnstileSiteKey,action:'wallet-topup',cData:user.id,theme:'dark',callback:value=>{token=value;},'expired-callback':()=>{token='';}});}catch{$('#topup-status').textContent=t('challengeError');}}
 if(!$('#topup-form'))return;
 $('#topup-form').onsubmit=async ev=>{
  ev.preventDefault();const status=$('#topup-status'),button=ev.target.querySelector('button[type="submit"]');
  if(demo){status.className='success';status.textContent=t('walletDemo');return;}
  const credits=Number($('#topup-amount').value);if(!Number.isInteger(credits)||credits<5){status.textContent=t('walletMinimum');return;}
  if(!token){status.textContent=t('challengeError');return;}
  const input={credits,currency:$('#topup-currency').value,locale,accepted:$('#topup-consent').checked,immediateDelivery:$('#topup-immediate').checked,adultConfirmed:$('#topup-adult').checked,termsVersion:wallet.termsVersion};button.disabled=true;status.textContent=t('preparing');
  try{const response=await request('/api/wallet/topup',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':checkoutKey(input)},body:JSON.stringify({...input,turnstileToken:token})});const result=await response.json();if(!response.ok)throw Error(result.error);forgetCheckout(input);location.assign(result.url);}
  catch(error){status.className='error';status.textContent=t(paymentError(error.message));button.disabled=false;token='';if(widget!==null)window.turnstile?.reset(widget);}
 };
}
export async function spendCredits(input,ctx,status,button){
 try{
  const response=await request('/api/wallet/spend',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':checkoutKey(input)},body:JSON.stringify(input)}),result=await response.json();
  if(response.status===401){ctx.login(input.badge,input.targetId);return;}
  if(!response.ok){if(result.error==='insufficient_credits'){const need=input.kind==='support'?input.amount/100:ctx.cost;await walletDialog(ctx,need);return;}if(response.status===409&&result.error==='price_changed')forgetCheckout(input);throw Error(result.error);}
  forgetCheckout(input);status.className='success';status.textContent=ctx.t('walletSpent',{n:result.cost,balance:result.balance});const link=document.createElement('a');link.href='/api/me/action-confirmation/'+encodeURIComponent(result.id);link.download='';link.className='text-link';link.textContent=ctx.t('downloadActionConfirmation');status.append(document.createElement('br'),link);await ctx.refresh();
 }catch(error){status.className='error';status.textContent=ctx.t(paymentError(error.message));}finally{if(button.isConnected)button.disabled=false;}
}
