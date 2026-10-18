import {readFile} from 'node:fs/promises';
import {operatorReady} from '../public/terms.js';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
let file='';try{file=await readFile('.dev.vars','utf8');}catch{}
const vars={...config.vars,...Object.fromEntries(file.split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')];})),...process.env};
const real=v=>Boolean(v&&!/replace|example|placeholder/i.test(v));
const uuid=v=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v||'');
const checks={
 'Dominio HTTPS / APP_URL':/^https:\/\//.test(vars.APP_URL||'')&&real(vars.APP_URL),
 'Cloudflare KV BADGES':/^[a-f0-9]{32}$/.test(config.kv_namespaces?.find(b=>b.binding==='BADGES')?.id||''),
 'D1 dedicada DB':uuid(config.d1_databases?.find(b=>b.binding==='DB')?.database_id),
 'Secreto de sesión':real(vars.AUTH_COOKIE_SECRET)&&vars.AUTH_COOKIE_SECRET.length>=32,
 'OAuth Google':real(vars.GOOGLE_CLIENT_ID)&&real(vars.GOOGLE_CLIENT_SECRET),
 'OAuth GitHub':real(vars.GITHUB_CLIENT_ID)&&real(vars.GITHUB_CLIENT_SECRET),
 'Turnstile de producción (sin claves de prueba)':real(vars.TURNSTILE_SITE_KEY)&&real(vars.TURNSTILE_SECRET_KEY)&&!(/^[123]x0+/.test(vars.TURNSTILE_SITE_KEY)||/^[123]x0+/.test(vars.TURNSTILE_SECRET_KEY)),
 'Polar token':real(vars.POLAR_ACCESS_TOKEN),
 'Polar producto y organización':uuid(vars.POLAR_PRODUCT_ID)&&uuid(vars.POLAR_ORGANIZATION_ID),
 'Portal de facturas Polar':real(vars.POLAR_ORGANIZATION_SLUG)&&/^[a-z0-9][a-z0-9-]{0,62}$/.test(vars.POLAR_ORGANIZATION_SLUG||''),
 'Polar Standard Webhooks':real(vars.POLAR_WEBHOOK_SECRET)&&/^whsec_[A-Za-z0-9+/=]+$/.test(vars.POLAR_WEBHOOK_SECRET||''),
 'Titular legal completo':operatorReady(vars),
 'Aceptación expresa del proveedor para producción':real(vars.POLAR_LIVE_APPROVAL_REFERENCE)
};
for(const [label,ok] of Object.entries(checks))console.log((ok?'OK':'PENDING')+'  '+label);
console.log('NO VERIFICADO POR ESTE DIAGNÓSTICO: recursos/migraciones remotos, dominio, callbacks OAuth, contratos de tratamiento, pruebas externas, cron y aceptación comercial real. Ver el informe de verificación para las pruebas manuales ya realizadas.');
console.log('Este diagnóstico no imprime secretos ni modifica recursos remotos. Ver docs/review-and-launch.md.');
if(Object.values(checks).some(v=>!v))process.exitCode=2;
