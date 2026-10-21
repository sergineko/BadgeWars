import {escapeXml as e} from './badges.js';
import {request} from './flow.js';

export function aliasPanel(user,t,locale){
 const locked=user.canChangeAlias===false,date=user.nextAliasChangeAt?new Date(user.nextAliasChangeAt).toLocaleString(locale,{dateStyle:'long',timeStyle:'short'}):'';
 return `<section class="alias-settings" aria-labelledby="alias-heading"><div class="alias-heading"><div><div class="eyebrow">${t('profileSettings')}</div><h2 id="alias-heading">${t('yourPublicAlias')}</h2></div><span class="alias-current">${user.alias?'@'+e(user.alias):t('aliasNotSet')}</span></div><p>${t('aliasPurpose')}</p><form id="public-alias-form"><label for="public-alias">${t('publicAlias')}</label><div class="alias-input-row"><div class="alias-input"><span aria-hidden="true">@</span><input id="public-alias" name="alias" value="${e(user.alias||'')}" pattern="[A-Za-z0-9_]{2,24}" minlength="2" maxlength="24" required autocomplete="nickname" autocapitalize="none" spellcheck="false" aria-describedby="alias-rules alias-window" ${locked?'readonly':''}></div><button class="primary" type="submit" ${locked?'disabled':''}>${t(user.alias?'saveAlias':'defineAlias')} ↗</button></div><p id="alias-rules" class="alias-rules">${t('aliasRules')}</p><p id="alias-window" class="alias-window ${locked?'alias-locked':''}">${locked?t('aliasLockedUntil',{date}):t('aliasChangeWarning')}</p><p id="alias-status" role="status" aria-live="polite"></p></form></section>`;
}

export function bindAliasForm({t,user,isCurrent,onProfile,toast}){
 const form=document.querySelector('#public-alias-form');if(!form)return;
 form.oninput=()=>{form.dataset.dirty=String(form.elements.alias.value.trim()!==(user.alias||''));};
 form.onsubmit=async event=>{
  event.preventDefault();if(user.canChangeAlias===false)return;
  const button=form.querySelector('button'),status=form.querySelector('#alias-status');button.disabled=true;form.dataset.saving='true';status.className='';status.textContent=t('savingAlias');
  try{
   const response=await request('/api/me/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({alias:form.elements.alias.value})});
   const result=await response.json();if(!isCurrent())return;
   if(!response.ok){if(result.profile){onProfile(result.profile);toast(t('aliasLocked'));return;}throw Error(result.error);}
   onProfile(result);toast(t(result.canChangeAlias?'aliasUnchanged':'aliasSaved'));
  }catch(error){if(!isCurrent())return;status.className='error';status.textContent=t(({alias_taken:'aliasTaken',alias_invalid:'aliasInvalid',alias_reserved:'aliasReserved',alias_locked:'aliasLocked',maintenance:'maintenanceText',rate_limited:'rateLimited',authentication_required:'aliasSignInAgain'})[error.message]||'aliasSaveFailed');}
  finally{form.dataset.saving='false';if(button.isConnected)button.disabled=false;}
 };
}
