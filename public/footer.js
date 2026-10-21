import {legalRoutes} from './legal.js';
import {brandMarkHtml} from './icons.js';
export function footerHtml(t,home,legalKeys){
 return `<div class="footer-main"><div class="footer-about"><a class="brand footer-brand" href="${home}" aria-label="BadgeWars"><span class="brand-icon" aria-hidden="true">${brandMarkHtml()}</span><span class="footer-wordmark">badge<b>wars</b></span></a><p>${t('footer')}</p></div><div class="footer-links"><p class="footer-heading">${t('legalNav')}</p><nav class="legal-footer" aria-label="${t('legalNav')}">${legalRoutes.map(path=>`<a class="text-link" href="${path}">${t(legalKeys[path][1])}</a>`).join('')}</nav></div></div><div class="footer-bottom"><p class="footer-credit"><span>© ${new Date().getFullYear()} · ${t('createdBy')} <a href="https://sergiotech.es/" target="_blank" rel="noopener noreferrer">SergioTech.es</a></span><span class="footer-rights">${t('rightsReserved')}</span></p><p class="footer-payment">${t('paymentNote')}</p></div>`;
}
