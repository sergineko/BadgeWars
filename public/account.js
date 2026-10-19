import {request} from './flow.js';
import {turnstile} from './wallet.js';
import {TERMS_VERSION} from './terms.js';
import {escapeXml as e} from './badges.js';
export async function billingDialog(ctx){
 const {t,open}=ctx;
 async function access(customerId){
  try{
   const response=await request('/api/me/billing-portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(customerId?{customerId}:{})});
   const result=await response.json();if(!response.ok)throw Error();
   if(ctx.isCurrent&&!ctx.isCurrent())return;
   if(result.url){location.assign(result.url);return;}
   if(!Array.isArray(result.accounts)||!result.accounts.length)throw Error();
   open(`<h2>${t('billingPortal')}</h2><p>${t('billingAccountsNote')}</p><div>${result.accounts.map((account,i)=>`<p><button class="outline" data-billing-account="${e(account.customer_id)}">${t('billingAccount',{n:i+1})} · ${e(new Date(account.created_at).toLocaleDateString(ctx.locale))} ↗</button></p>`).join('')}</div><p id="billing-status" role="status"></p>`);
   document.querySelectorAll('[data-billing-account]').forEach(button=>button.onclick=()=>access(button.dataset.billingAccount));
  }catch{open(`<h2>${t('billingPortal')}</h2><p>${t('billingUnavailable')}</p>`);}
 }
 await access();
}
let activeWidget=null;
export function clearEmailChallenge(){if(activeWidget!==null){window.turnstile?.remove(activeWidget);activeWidget=null;}}

export async function emailDialog(ctx,mode='login',actionCode=''){
 const {t,open}=ctx,$=s=>document.querySelector(s),registration=mode==='register',reset=mode==='reset'||mode==='resend',confirm=mode==='confirm',newPassword=mode==='password';
 clearEmailChallenge();
 if(!ctx.enabled){open(`<div class="eyebrow">BADGEWARS / ACCOUNT</div><h2>${t('emailLogin')}</h2><p>${t('emailSetup')}</p><div class="social-buttons">${(ctx.providers||[]).map(provider=>`<button class="social-button" data-provider="${provider}">${t('continueWith',{provider:provider==='google'?'Google':'GitHub'})} ↗</button>`).join('')}</div>`);return;}
 const title=t({login:'emailLogin',register:'emailRegister',reset:'emailReset',resend:'emailResend',confirm:'emailConfirm',password:'emailNewPassword'}[mode]);
 open(`<div class="eyebrow">BADGEWARS / ACCOUNT</div><h2>${title}</h2><p>${t('emailPrivacy')}</p><form id="email-form" class="account-form">
 ${!confirm&&!newPassword?`<label for="account-email">${t('emailLabel')}</label><input id="account-email" name="email" type="email" autocomplete="email" maxlength="254" required>`:''}
 ${!reset?`<label for="account-password">${t('passwordLabel')}</label><input id="account-password" name="password" type="password" autocomplete="${registration||newPassword?'new-password':'current-password'}" minlength="15" maxlength="256" required><small>${t(confirm?'emailConfirmPassword':'passwordHint')}</small>`:''}
 <div class="account-trap" aria-hidden="true"><label for="account-website">Website</label><input id="account-website" name="website" tabindex="-1" autocomplete="off"></div>
 ${registration?`<label class="wallet-consent"><input id="account-consent" type="checkbox" required><span>${t('accountConsent')} <a href="/terms" target="_blank" rel="noopener">${t('readTerms')} ↗</a> · <a href="/privacy" target="_blank" rel="noopener">${t('privacyLink')}</a></span></label>`:''}
 <div id="account-challenge"></div><button type="submit" class="primary" ${ctx.enabled?'':'disabled'}>${title} ↗</button><p id="account-status" role="status">${ctx.enabled?'':t('emailSetup')}</p></form>
 <div class="account-links">${mode==='login'?`<button class="text-link" data-email-mode="register">${t('emailRegister')}</button><button class="text-link" data-email-mode="reset">${t('emailForgot')}</button><button class="text-link" data-email-resend>${t('emailResend')}</button>`:`<button class="text-link" data-email-mode="login">${t('emailLogin')}</button>`}</div><p class="muted">${t('accountSeparate')}</p>`);
 let token='',widget=null;
 const action={login:'auth-login',register:'auth-register',reset:'auth-reset',resend:'auth-resend',confirm:'auth-confirm',password:'auth-password'}[mode];
 const challengeElement=$('#account-challenge');
 if(ctx.enabled)try{const ts=await turnstile();if($('#account-challenge')!==challengeElement)return;widget=ts.render(challengeElement,{sitekey:ctx.siteKey,action,cData:'auth',theme:'dark',callback:value=>{token=value;},'expired-callback':()=>{token='';}});activeWidget=widget;}catch{if($('#account-challenge')===challengeElement&&$('#account-status'))$('#account-status').textContent=t('challengeError');}
 if(!$('#email-form'))return;
 document.querySelectorAll('[data-email-mode]').forEach(button=>button.onclick=()=>emailDialog(ctx,button.dataset.emailMode));
 const resend=document.querySelector('[data-email-resend]');if(resend)resend.onclick=()=>emailDialog(ctx,'resend');
 if(mode==='resend'&&ctx.enabled)$('#account-status').textContent=t('emailResendHint');
 $('#email-form').onsubmit=async event=>{
  event.preventDefault();const form=event.target,status=$('#account-status'),button=form.querySelector('[type="submit"]');if(!token){status.textContent=t('challengeError');return;}
  const input={email:$('#account-email')?.value.trim(),password:$('#account-password')?.value,website:$('#account-website').value,turnstileToken:token,locale:ctx.locale,accepted:Boolean($('#account-consent')?.checked),termsVersion:TERMS_VERSION,code:actionCode};
  button.disabled=true;status.className='';status.textContent=t('preparing');
  try{const response=await request('/api/auth/email/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),result=await response.json();
   if(!response.ok)throw Error(result.error);
   form.reset();status.className='success';status.textContent=t(result.status==='signed_in'?'emailSignedIn':result.status==='confirmed'?'emailConfirmed':result.status==='password_changed'?'emailPasswordChanged':'emailSent');
   if(result.status==='signed_in')location.assign(ctx.destination||'/collection');
  }catch(error){status.className='error';status.textContent=t(({rate_limited:'rateLimited',challenge_failed:'challengeError',invalid_password:'passwordHint',invalid_email:'emailInvalid',invalid_consent:'accountConsentRequired',email_auth_unavailable:'emailSetup',invalid_action_code:'emailInvalidCode',invalid_credentials:'emailInvalidCredentials'})[error.message]||'emailFailed');}
  finally{button.disabled=!ctx.enabled;token='';if(widget!==null&&activeWidget===widget)window.turnstile?.reset(widget);}
 };
}

export function emailAction(value){const url=new URL(value);if(url.pathname!=='/account/email')return null;const fragment=url.hash.slice(1).split('/'),mode=fragment.length===2?fragment[0]:url.searchParams.get('mode'),code=fragment.length===2?fragment[1]:url.searchParams.get('oobCode');return code&&code.length<2048&&['verifyEmail','resetPassword'].includes(mode)?{mode:mode==='verifyEmail'?'confirm':'password',code}:null;}

export function refundDialog(ctx){
 const {open,t}=ctx;open(`<div class="eyebrow">BADGEWARS / SUPPORT</div><h2>${t('refundRequestTitle')}</h2><p>${t('refundRequestPolicy')}</p><form id="refund-request-form" class="account-form"><label for="refund-reference">${t('refundReference')}</label><input id="refund-reference" required maxlength="36" autocomplete="off" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"><button class="primary">${t('refundRequestSubmit')}</button><p id="refund-request-status" role="status"></p></form>`);
 document.querySelector('#refund-request-form').onsubmit=async event=>{event.preventDefault();const status=document.querySelector('#refund-request-status'),button=event.target.querySelector('button');button.disabled=true;try{const r=await request('/api/me/refund-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topupId:document.querySelector('#refund-reference').value.trim()})});const value=await r.json();if(!r.ok)throw Error(value.error);status.className='success';status.textContent=t('refundRequestQueued')+' '+value.id;}catch(error){status.className='error';status.textContent=t(({refund_service_used:'refundUsed',refund_already_credited:'refundCredited',refund_insufficient_balance:'refundInsufficient',refund_wallet_unavailable:'walletFrozen',refund_not_found:'refundNotFound',refund_payment_unverified:'refundUnverified',rate_limited:'rateLimited'})[error.message]||'refundRequestFailed');}finally{button.disabled=false;}};
}
