import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {badgeSvg} from '../public/badges.js';

// Static marketing artwork. These are illustrative badges, never live account data.
// To regenerate: node scripts/build-social-card.mjs [absolute path to sharp's entry point]
const width=1200,height=630;
const logo=(await readFile('public/favicon.svg','utf8')).replace('<svg ','<svg x="60" y="47" width="48" height="48" ');
const badge=(id,state,x,y,w,angle)=>`<g transform="translate(${x} ${y}) rotate(${angle} ${w/2} ${w*280/1200})"><g filter="url(#shadow)"><svg width="${w}" height="${w*280/600}" viewBox="0 0 600 280">${badgeSvg(id,state,false,'en')}</svg></g></g>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
 <radialGradient id="glow"><stop stop-color="#7e43ce" stop-opacity=".55"/><stop offset="1" stop-color="#15101f" stop-opacity="0"/></radialGradient>
 <linearGradient id="surface" x2="1" y2="1"><stop stop-color="#14111e"/><stop offset="1" stop-color="#090b10"/></linearGradient>
 <linearGradient id="ink" x2="1" y2="1"><stop stop-color="#e6d5ff"/><stop offset="1" stop-color="#a978ff"/></linearGradient>
 <linearGradient id="rim"><stop stop-color="#c29afa" stop-opacity=".3"/><stop offset="1" stop-color="#c29afa" stop-opacity=".03"/></linearGradient>
 <filter id="shadow" x="-30%" y="-40%" width="170%" height="200%"><feDropShadow dx="0" dy="18" stdDeviation="15" flood-color="#020307" flood-opacity=".8"/></filter>
 <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#d4b5ff" stroke-opacity=".035"/></pattern>
</defs>
<rect width="1200" height="630" fill="url(#surface)"/>
<rect width="1200" height="630" fill="url(#grid)"/>
<ellipse cx="945" cy="315" rx="470" ry="405" fill="url(#glow)"/>
<rect x="18.5" y="18.5" width="1163" height="593" rx="24" fill="none" stroke="url(#rim)"/>
<g fill="none" stroke="#b488ed"><ellipse cx="925" cy="342" rx="252" ry="247" stroke-opacity=".13" transform="rotate(-28 925 342)"/><ellipse cx="925" cy="342" rx="305" ry="185" stroke-opacity=".17" transform="rotate(-28 925 342)"/></g>
${logo}<text x="118" y="82" fill="#f1eafa" font-family="Arial,sans-serif" font-size="34" font-weight="700" letter-spacing="-1.8">badge<tspan fill="#c8a3ff">wars</tspan></text>
<text x="66" y="167" fill="#bca4d8" font-family="Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="2.5">TU PERFIL. TU POSICIÓN.</text>
<text x="60" y="274" fill="#f6f1fb" font-family="Arial,sans-serif" font-size="88" font-weight="700" letter-spacing="-5">Small badge.</text>
<text x="60" y="370" fill="url(#ink)" font-family="Arial,sans-serif" font-size="100" font-weight="700" letter-spacing="-5">Big ego.</text>
<text x="65" y="427" fill="#b5a9c5" font-family="Arial,sans-serif" font-size="24" letter-spacing="-.4">Badges que hablan por ti.</text>
<rect x="64" y="492" width="255" height="53" rx="26.5" fill="#d8ff8f"/>
<text x="85" y="526" fill="#1d2810" font-family="Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="-.5">badgewars.com</text><path d="M280 510h13v13m-14 1 14-14" fill="none" stroke="#1d2810" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
${badge('genesis',{edition:1,owner:'your_alias',amount:100000},739,69,405,12)}
${badge('flex',{owner:'your_alias',amount:100,rank:1},601,230,555,-10)}
${badge('quality',{owner:'your_alias',points:'250',rank:1,supporterCount:12},733,424,399,7)}
<g fill="#d7bfff"><path d="M654 125q0 18 18 18-18 0-18 18 0-18-18-18 18 0 18-18Z"/><circle cx="1122" cy="342" r="4"/><circle cx="620" cy="497" r="3"/></g>
<text x="66" y="589" fill="#80748e" font-family="Arial,sans-serif" font-size="11" letter-spacing="2">PERSONAL BADGES · DYNAMIC RANKS · SVG / API</text>
</svg>`;
await mkdir('artifacts/social-preview',{recursive:true});
await writeFile('artifacts/social-preview/badgewars-share-v1.svg',svg);
const renderer=process.argv[2];
const sharp=(await import(renderer?pathToFileURL(renderer).href:'sharp')).default;
await mkdir('public/social',{recursive:true});
const output='public/social/badgewars-share-v1.jpg';
await sharp(Buffer.from(svg)).flatten({background:'#0c0d12'}).jpeg({quality:91,mozjpeg:true,chromaSubsampling:'4:4:4'}).toFile(output);
console.log(`Created ${output} (${width} × ${height}).`);
