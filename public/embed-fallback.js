// Included in the host page's HTML: no request to BadgeWars is needed to draw it.
// Never retain a ranking or paid entitlement while its live state is unavailable.
export function embedFallback(locale='en',compact=false){
 const es=locale==='es',width=compact?570:600,height=compact?56:280;
 const title=es?'Estado sin verificar':'Status unverified',detail=es?'No se ha podido cargar el badge en directo.':'The live badge could not be loaded.';
 return {width,height,title,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" style="display:block;width:100%;height:auto"><rect x="1" y="1" width="${width-2}" height="${height-2}" rx="${compact?8:24}" fill="#101625" stroke="#39435c"/><g fill="#aebbd2" font-family="Segoe UI,Arial,sans-serif" text-anchor="middle">${compact?`<text x="285" y="23" font-size="9" letter-spacing="2">BADGEWARS</text><text x="285" y="40" font-size="13" fill="#e5eaff">${title}</text>`:`<circle cx="300" cy="64" r="18" fill="#202b42"/><path d="M291 64h5m8 0h5m-17-6 16 12" stroke="#aebbd2" stroke-width="2" stroke-linecap="round"/><text x="300" y="108" font-size="11" letter-spacing="3">BADGEWARS / LIVE STATUS</text><text x="300" y="145" font-size="26" fill="#edf1ff">${title}</text><text x="300" y="175" font-size="14">${detail}</text><text x="300" y="216" font-size="13" fill="#c6b3ff">${es?'Consultar en BadgeWars':'Open BadgeWars'} ↗</text>`}</g></svg>`};
}

export function resilientEmbed(imageUrl,targetUrl,alt,locale='en',compact=false){
 const {width,svg}=embedFallback(locale,compact),e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // CSS image failure paints nothing, unlike a broken <img>. The local SVG stays
 // underneath during loading, timeouts, DNS/ISP failures and HTTP errors. No JS,
 // external fallback domain, cached ranking or reusable authorization is needed.
 return `<a href="${e(targetUrl)}" aria-label="${e(alt)} · ${e(locale==='es'?'Consultar estado en BadgeWars':'View status on BadgeWars')}" style="display:inline-block;position:relative;width:${width}px;max-width:100%;vertical-align:middle;text-decoration:none">${svg}<span aria-hidden="true" style="position:absolute;inset:0;display:block;background-image:url(&quot;${e(imageUrl)}&quot;);background-position:center;background-size:contain;background-repeat:no-repeat"></span></a>`;
}
