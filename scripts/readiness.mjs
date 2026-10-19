import {readFile} from 'node:fs/promises';
import {operatorReady} from '../public/terms.js';
import {apiKeyReady} from '../src/dodo.mjs';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const production=process.argv.includes('--production');
let file='';try{file=await readFile(production?'.dev.vars.production':'.dev.vars','utf8');}catch{}
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
 'Correo propio / remitente':vars.EMAIL_FROM==='no-reply@badgewars.com'&&config.send_email?.some(b=>b.name==='EMAIL'),
 'Acceso por correo activado':vars.EMAIL_AUTH_ENABLED==='true',
 'Secreto independiente de contraseñas':real(vars.PASSWORD_PEPPER)&&vars.PASSWORD_PEPPER.length>=32,
 'Presupuesto CPU para scrypt (requiere Paid)':config.compatibility_flags?.includes('nodejs_compat')&&config.limits?.cpu_ms>=1000,
 'Turnstile de producción (sin claves de prueba)':real(vars.TURNSTILE_SITE_KEY)&&real(vars.TURNSTILE_SECRET_KEY)&&!(/^[123]x0+/.test(vars.TURNSTILE_SITE_KEY)||/^[123]x0+/.test(vars.TURNSTILE_SECRET_KEY)),
 'Dodo entorno explícito':vars.DODO_PAYMENTS_ENVIRONMENT===(production?'live_mode':'test_mode'),
 'Dodo API key (autenticación remota pendiente)':apiKeyReady(vars.DODO_PAYMENTS_API_KEY,production?'live_mode':'test_mode'),
 'Dodo negocio':/^bus_[A-Za-z0-9_-]{3,120}$/.test(vars.DODO_BUSINESS_ID||'')&&real(vars.DODO_BUSINESS_ID),
 'Dodo productos USD/EUR':/^pdt_[A-Za-z0-9_-]{3,120}$/.test(vars.DODO_PRODUCT_ID_USD||'')&&/^pdt_[A-Za-z0-9_-]{3,120}$/.test(vars.DODO_PRODUCT_ID_EUR||'')&&real(vars.DODO_PRODUCT_ID_USD)&&real(vars.DODO_PRODUCT_ID_EUR),
 'Dodo Standard Webhooks':real(vars.DODO_PAYMENTS_WEBHOOK_KEY),
 'Titular legal completo':operatorReady(vars),
 'Aceptación expresa del proveedor para producción':real(vars.DODO_LIVE_APPROVAL_REFERENCE)
};
console.log(production?'Configuración de producción (.dev.vars.production + wrangler).':'Configuración local (.dev.vars + wrangler).');
for(const [label,ok] of Object.entries(checks))console.log((ok?'OK':'PENDING')+'  '+label);
console.log('NO VERIFICADO POR ESTE DIAGNÓSTICO: recursos/migraciones remotos, dominio, callbacks OAuth, contratos de tratamiento, pruebas externas, cron y aceptación comercial real. Ver el informe de verificación para las pruebas manuales ya realizadas.');
console.log('Este diagnóstico no imprime secretos ni modifica recursos remotos. Ver docs/review-and-launch.md.');
if(Object.values(checks).some(v=>!v))process.exitCode=2;
