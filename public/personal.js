import {catalog,escapeXml as e} from './badges.js';
import {request} from './flow.js';
const $=s=>document.querySelector(s);
export async function personalDialog(holderId,ctx){
 const {t,open,svg,toast}=ctx,item=ctx.items.find(p=>p.id===holderId);
 if(ctx.page!=='/collection'||!ctx.user||!item){toast(t('ownerCodeOnly'));return;}
 const badge=catalog.find(b=>b.id===item.badgeId);let version=0;
 open(`<div class="eyebrow">${t('personalCode')}</div><h2>${badge.name}</h2><p>${t('personalCodeFor',{owner:'@'+e(item.owner)})}</p><label for="embed-type">${t('badgeStyle')}</label><select id="embed-type"><option value="">${t('collectible')}</option><option value="compact">${t('compact')}</option></select><div id="embed-preview"><div id="public-live-badge" data-holder="${item.id}" data-badge="${item.badgeId}" data-style="">${svg(item.badgeId,item)}</div><small id="live-badge-status" class="live-badge-note">${t(item.seasonStatus==='closed'?'seasonFrozenNote':'badgeUpdates')}</small></div><label for="embed-format">${t('format')}</label><select id="embed-format"><option value="html-safe">${t('embedResilient')}</option><option value="md">Markdown / GitHub</option><option value="html">HTML</option></select><p id="embed-help">${t('embedResilientHelp')}</p><pre id="embed-code"></pre><button class="primary" id="copy-code" disabled>${t('copy')} ↗</button><p id="embed-status" role="status"></p><p>${t(item.badgeId==='quality'?'embedBagText':'embedText')}</p>`);
 const generate=async()=>{
  const current=++version,button=$('#copy-code');button.disabled=true;$('#embed-code').textContent='';$('#embed-status').textContent=t('checkingOwner');$('#embed-help').textContent=t($('#embed-format').value==='html-safe'?'embedResilientHelp':'embedStandardHelp');
  try{
   const query=new URLSearchParams({badge:holderId,lang:ctx.locale,format:$('#embed-format').value});if($('#embed-type').value)query.set('style',$('#embed-type').value);
   const response=await request('/api/me/embed?'+query);if(!response.ok)throw Error(response.status===401?'session':'ownership');const result=await response.json();
   if(current!==version||!$('#embed-code'))return null;
   if(result.id!==item.id||result.badgeId!==item.badgeId)throw Error('ownership');
   $('#embed-code').textContent=result.code;$('#public-live-badge').dataset.style=$('#embed-type').value;$('#public-live-badge').innerHTML=svg(item.badgeId,item,$('#embed-type').value==='compact');$('#embed-status').textContent=t('ownerVerified');button.disabled=false;return result.code;
  }catch(error){if(current===version&&$('#embed-status')){$('#embed-status').className='error';$('#embed-status').textContent=t(error.message==='session'?'receiptSignIn':'embedUnavailable');}return null;}
 };
 $('#embed-type').onchange=generate;$('#embed-format').onchange=generate;
 $('#copy-code').onclick=async()=>{const code=await generate();if(!code)return;try{await navigator.clipboard.writeText(code);toast(t('copied'));}catch{toast(t('copyManual'));}};
 await generate();
}
