import {trustTier} from './points.js';

// Self-contained vector artwork: no fonts, images or scripts are fetched by embeds.
export function collectibleSvg({id,state,uid,c,label,owner,displayAmount,supportAmount,supporters,topLabel,trustPoints,t,tr,locale,e,fit}){
 const p=name=>`url(#${uid}-${name})`;
 const text=(x,y,value,size=12,color='#fff',extra='')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}" ${extra}>${e(value)}</text>`;
 const mono=(x,y,value,size=10,color='#fff',extra='')=>text(x,y,value,size,color,`font-family="monospace" ${extra}`).replace('font-family="Arial,sans-serif" ','');
 const star=(x,y,r=8,color='#fff')=>`<path d="M${x} ${y-r}Q${x} ${y} ${x+r} ${y}Q${x} ${y} ${x} ${y+r}Q${x} ${y} ${x-r} ${y}Q${x} ${y} ${x} ${y-r}Z" fill="${color}"/>`;
 let body='';
 if(id==='flex'){
  const rank=state.owner&&(state.seasonStatus!=='closed'||state.rank)?'#'+String(state.rank||1).padStart(2,'0'):'—';
  body=`<rect x="17" y="24" width="566" height="242" rx="27" fill="#090510"/>
   <rect x="12" y="12" width="576" height="242" rx="27" fill="${p('holo')}" stroke="#e1ccff" stroke-width="1.5"/>
   <rect x="21" y="21" width="558" height="224" rx="21" fill="${p('purple')}" stroke="#e2d4ff" stroke-opacity=".35"/>
   <path d="M23 180L206 21h115L64 245H23Zm199 65L476 21h40L262 245Z" fill="#f7d5ff" opacity=".07"/>
   <path d="M390 21h168q21 0 21 21v94Z" fill="#d6ff8b" opacity=".09"/>
   <circle cx="110" cy="119" r="75" fill="#8b4def" opacity=".25"/><circle cx="110" cy="119" r="66" fill="none" stroke="#dcbdff" stroke-opacity=".5"/>
   <circle cx="110" cy="119" r="59" fill="#201035" stroke="#ba8aff"/>
   <path d="M71 133L61 87l29 22 20-40 20 40 29-22-10 46Z" fill="${p('crown')}" stroke="#f4e5ff" stroke-width="2"/>
   <path d="M75 143h70m-61 10h52" stroke="#ddb2ff" stroke-width="3" stroke-linecap="round"/><path d="M90 110l20 20 20-20" fill="none" stroke="#fff" stroke-opacity=".65"/>
   ${star(62,54,10,'#dfff9d')}${star(164,170,8,'#eacfff')}${star(555,49,9,'#f9d5ff')}
   ${mono(207,51,(state.showSeason?tr(locale,'seasonNumber',{n:state.seasonNumber||1}).toUpperCase()+' / ':'')+t('flexTag'),9,'#dfc6ff','letter-spacing="2"')}${text(204,91,'THE APEX FLEX',30,'#fff6ff','font-weight="800" letter-spacing="-.8"')}
   ${text(207,116,t(state.seasonStatus==='closed'?'finalRank':state.rank>1?'svgOvertaken':state.owner?'svgCurrent':'svgSupporterShort'),12,'#d3b9e9')}
   <rect x="205" y="136" width="88" height="48" rx="10" fill="#dfff94"/>
   ${mono(218,150,t('svgRank').toUpperCase(),7,'#293214','letter-spacing="1"')}${text(217,176,rank,fit(rank,65,25),'#20280d','font-weight="800"')}
   ${mono(313,148,t(state.owner?'svgPaid':'nextPrice').toUpperCase(),8,'#cfb5e3','letter-spacing="1.5"')}${text(313,179,displayAmount,fit(displayAmount,240,31),'#f9edff','font-weight="700" letter-spacing="-1"')}
   <path d="M39 201h522" stroke="#e5c7ff" stroke-opacity=".22"/>
   ${mono(40,225,t('heldBy').toUpperCase(),8,'#b997d3','letter-spacing="1"')}${text(144,226,owner,fit(owner,353,15),'#f4e7ff','font-weight="600"')}${star(551,221,6,'#dfff94')}`;
 }else if(id==='bait'){
  const ruined=Boolean(state.owner),status=ruined?'#ffdc9f':'#baffb1';
  body=`<rect x="16" y="28" width="568" height="238" rx="20" fill="#240e0b"/>
   <rect x="12" y="13" width="576" height="241" rx="20" fill="${p('coral')}" stroke="#ffd0a9" stroke-width="1.5"/>
   <rect x="22" y="23" width="556" height="221" rx="13" fill="#271a1b"/>
   <path d="M35 24h368v219H35q-12 0-12-12V36q0-12 12-12Z" fill="${p('redface')}"/>
   <path d="M404 24h162q12 0 12 12v196q0 12-12 12H404Z" fill="#ffd3a2"/>
   <path d="M405 24v219" stroke="#110e12" stroke-width="4"/>
   ${mono(43,48,t('baitTag'),9,'#ffc1a5','letter-spacing="2"')}${text(40,86,'DON’T CLICK',30,'#fff3de','font-weight="900" letter-spacing="-.8"')}${text(40,121,'THIS.',39,'#fff3de','font-weight="900" letter-spacing="-1"')}
   <path d="M43 140h239" stroke="#ffbaa6" stroke-opacity=".25"/>
   <rect x="42" y="155" width="${ruined?132:114}" height="23" rx="11.5" fill="${status}"/>
   <circle cx="54" cy="166.5" r="3" fill="#253126"/>${mono(65,170,t(ruined?'svgRuined':'untouched').toUpperCase(),9,'#273126','font-weight="700"')}
   ${text(43,205,owner,fit(owner,333,16),'#f8d8cb','font-weight="600"')}${mono(43,226,'BADGEWARS / TEMPTATION',8,'#c58c7d','letter-spacing="1.5"')}
   <circle cx="490" cy="107" r="61" fill="#ab583d" opacity=".25"/><circle cx="490" cy="102" r="57" fill="#4d2926"/>
   <circle cx="490" cy="100" r="48" fill="#ba3d35" stroke="#301c1d" stroke-width="3"/>
   <circle cx="490" cy="94" r="45" fill="${p('button')}" stroke="#ffb8a5" stroke-width="2"/>
   <path d="M468 73q21-18 44 1" stroke="#fff3d0" stroke-width="5" stroke-linecap="round" opacity=".5" fill="none"/>
   <path d="M479 75v35l10-9 9 18 9-5-10-17 13-3Z" fill="#fff0dc" stroke="#bc3d3e" stroke-width="1.5"/>
   ${text(490,190,displayAmount,fit(displayAmount,145,29),'#492322','font-weight="800" text-anchor="middle"')}${mono(490,209,t(ruined?'svgPaid':'ruin').toUpperCase(),9,'#643b2e','text-anchor="middle" letter-spacing="1"')}
   <path d="M422 227h138" stroke="${p('hazard')}" stroke-width="6"/>${[31,569].flatMap(x=>[32,235].map(y=>`<circle cx="${x}" cy="${y}" r="2.5" fill="#ffc2a1"/>`)).join('')}`;
 }else if(id==='funded'){
  body=`<path d="M26 26h548v230H26Z" fill="#071b16"/>
   <rect x="12" y="12" width="576" height="240" rx="17" fill="#d6e9d0" stroke="#f1ffe8" stroke-width="1.5"/>
   <path d="M29 13h542q16 0 16 16v25H13V29q0-16 16-16Z" fill="#ecf4e4"/>
   <circle cx="33" cy="34" r="5" fill="#f19f89"/><circle cx="51" cy="34" r="5" fill="#dec684"/><circle cx="69" cy="34" r="5" fill="#7cae89"/>
   ${mono(302,38,'badgewars / build.funded',10,'#4b6153','text-anchor="middle"')}${mono(557,38,'↗',14,'#47604b','text-anchor="end"')}
   <rect x="22" y="63" width="556" height="179" rx="9" fill="#0d2821"/>
   <path d="M22 209h556" stroke="#b9efbd" stroke-opacity=".2"/><path d="M370 64v144" stroke="#b9efbd" stroke-opacity=".2"/>
   ${mono(41,88,'~/'+t('svgBuild'),9,'#82ba95','letter-spacing="1"')}${text(40,124,'BUILD FUNDED',29,'#e0ffcf','font-weight="800" letter-spacing="-1"')}
   ${mono(42,150,'> npm run keep-building',11,'#8de6b4')}${mono(42,174,'</> '+t('developerBadge'),10,'#b7d3bb')}
   <path d="M282 83l16-8 15 8v18l-15 9-16-9Z" fill="#a6ef8c" opacity=".15"/>
   <path d="M392 86h164v102H392Z" fill="${p('green')}"/>
   <path d="M408 111l-9 9 9 9m29-18 9 9-9 9m-12-23-5 28" fill="none" stroke="#17452b" stroke-width="2.5" stroke-linecap="round"/>
   ${mono(454,124,'BUILD',9,'#1f4b30','letter-spacing="2"')}${text(474,169,'DEVELOPER',19,'#163823','font-weight="800" text-anchor="middle"')}
   <circle cx="44" cy="225" r="3" fill="#baff94"/>${text(56,230,owner,fit(owner,451,14),'#d5edcf','font-weight="600"')}${mono(555,229,'</>',13,'#8fae95','text-anchor="end"')}`;
 }else{
  const tier=trustTier(state),rank=state.owner&&Number.isInteger(state.rank)&&state.rank>0?'#'+String(state.rank).padStart(2,'0'):'—';
  const level=trustPoints==='0'?0:trustPoints.length,stage=Math.min(3,level),scale=[.8,.88,.95,1][stage];
  body=`<rect x="17" y="25" width="568" height="240" rx="30" fill="#081526"/>
   <rect x="12" y="12" width="576" height="242" rx="30" fill="${p('ice')}" stroke="#c3f4ff" stroke-width="1.5"/>
   <rect x="21" y="21" width="558" height="224" rx="23" fill="#0c2438"/>
   <path d="M44 21h146v224H44q-23 0-23-23V44q0-23 23-23Z" fill="${p('bagbg')}"/>
   <circle cx="100" cy="123" r="65" fill="none" stroke="#c4f4ff" stroke-opacity=".18"/><circle cx="100" cy="123" r="55" fill="none" stroke="#c4f4ff" stroke-opacity=".15" stroke-dasharray="2 6"/>
   <g transform="translate(${100*(1-scale)} ${177*(1-scale)}) scale(${scale})"><ellipse cx="100" cy="184" rx="45" ry="8" fill="#041a2a" opacity=".5"/>
   <path d="M83 82L72 55l18 6 11-12 11 12 18-6-12 27c3 17 34 39 32 68-2 24-20 33-50 33s-48-9-50-33c-2-29 30-51 33-68Z" fill="${p('bag')}" stroke="#c8fbff" stroke-width="2"/>
   <path d="M83 82q18 7 35 0m-35 7q18 6 36 0m-2-3q18 4 15 18" fill="none" stroke="#b9ffff" stroke-width="3" stroke-linecap="round"/>
   <path d="M65 144q3-24 17-35" fill="none" stroke="#ddffff" stroke-opacity=".4" stroke-width="5" stroke-linecap="round"/>
   <circle cx="102" cy="137" r="22" fill="#103a53" stroke="#b9f6ff" stroke-opacity=".7"/><path d="M92 138l7 7 15-18" stroke="#bdffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
   ${star(153,61,10,'#d0ffff')}${star(49,183,7,c)}${mono(103,221,'TRUST BAG',10,'#d4faff','font-weight="700" text-anchor="middle" letter-spacing="2"')}
   ${mono(211,49,t('trustPosition').toUpperCase(),9,'#98c3d4','letter-spacing="2"')}${text(207,87,t(tier.label),fit(t(tier.label),343,24),'#ebfaff','font-weight="700" letter-spacing="-.5"')}
   ${text(204,156,rank,fit(rank,223,69),c,'font-weight="800" letter-spacing="-3"')}
   <circle cx="512" cy="131" r="32" fill="${c}" fill-opacity=".12" stroke="${c}" stroke-opacity=".5"/><path d="M512 107l18 6v17q-1 13-18 23-17-10-18-23v-17Z" fill="none" stroke="${c}" stroke-width="1.5"/><path d="M503 129l6 6 12-14" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
   ${mono(512,178,t(tier.stamp),fit(t(tier.stamp),93,9),c,'text-anchor="middle" letter-spacing="1"')}
   ${text(211,181,supportAmount+' · '+tr(locale,'supporterCount',{n:supporters}),fit(supportAmount+' · '+tr(locale,'supporterCount',{n:supporters}),260,12),'#a8cbdb')}
   <path d="M208 196h350" stroke="#91d7f1" stroke-opacity=".2"/>
   ${text(211,219,state.owner?owner:t('svgBagReady'),fit(state.owner?owner:t('svgBagReady'),342,15),'#e0f3ff','font-weight="600"')}
   ${mono(211,236,topLabel||tr(locale,'trustLevel',{n:level}),fit(topLabel,342,9),'#82acc2')}`;
 }
 const defs=`<linearGradient id="${uid}-holo" x2="1" y2="1"><stop stop-color="#b9b5ff"/><stop offset=".2" stop-color="#eaadf3"/><stop offset=".48" stop-color="#7864c3"/><stop offset=".75" stop-color="#b8eff2"/><stop offset="1" stop-color="#cf86d7"/></linearGradient>
  <linearGradient id="${uid}-purple" x2="1" y2=".9"><stop stop-color="#66358b"/><stop offset=".52" stop-color="#33204f"/><stop offset="1" stop-color="#291a3d"/></linearGradient>
  <linearGradient id="${uid}-crown" x2=".7" y2="1"><stop stop-color="#f5d3ff"/><stop offset=".46" stop-color="#be84fa"/><stop offset="1" stop-color="#794ad3"/></linearGradient>
  <linearGradient id="${uid}-coral" x2=".8" y2="1"><stop stop-color="#ffc78a"/><stop offset=".4" stop-color="#fa8a70"/><stop offset="1" stop-color="#c34b46"/></linearGradient>
  <linearGradient id="${uid}-redface" x2="1" y2="1"><stop stop-color="#692e32"/><stop offset="1" stop-color="#311e24"/></linearGradient>
  <linearGradient id="${uid}-button" x2=".4" y2="1"><stop stop-color="#ff9d77"/><stop offset=".4" stop-color="#ef655a"/><stop offset="1" stop-color="#cd3a48"/></linearGradient>
  <pattern id="${uid}-hazard" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="12" height="12" fill="#f6b77f"/><rect width="6" height="12" fill="#4d3027"/></pattern>
  <linearGradient id="${uid}-green" x2=".7" y2="1"><stop stop-color="#d2ff9b"/><stop offset="1" stop-color="#7cd898"/></linearGradient>
  <linearGradient id="${uid}-ice" x2="1" y2="1"><stop stop-color="#a6edff"/><stop offset=".3" stop-color="#7191bf"/><stop offset=".65" stop-color="#b6def6"/><stop offset="1" stop-color="#5e7fa4"/></linearGradient>
  <linearGradient id="${uid}-bagbg" x2=".9" y2="1"><stop stop-color="#245c7c"/><stop offset="1" stop-color="#12324c"/></linearGradient>
  <linearGradient id="${uid}-bag" x2=".6" y2="1"><stop stop-color="#80e3ed"/><stop offset=".45" stop-color="#3eacbd"/><stop offset="1" stop-color="#247d9b"/></linearGradient>`;
 // Only emit gradients actually used by this badge to keep SVG requests small.
 const names=new Set([...body.matchAll(new RegExp(`${uid}-([a-z]+)\\)`, 'g'))].map(m=>m[1]));
 const usedDefs=[...defs.matchAll(/<(linearGradient|pattern)\b[\s\S]*?<\/\1>/g)].filter(m=>[...names].some(name=>m[0].includes(`id="${uid}-${name}"`))).map(m=>m[0]).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280" role="img" ${id==='quality'?`data-trust-tier="${trustTier(state).id}"`:''} aria-label="${label}"><title>${label}</title><defs>${usedDefs}</defs>${body}</svg>`;
}
