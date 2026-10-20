// Read-only live preflight. No checkout, product, customer, webhook or payment writes.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {apiKeyReady,dodoClient,paymentsReady,productMatches,providerId,paymentEvents} from '../src/dodo.mjs';
const configured=value=>typeof value==='string'&&value.length>3&&!/replace|example|placeholder/i.test(value);
export function liveChecks(env){return {
 'Dominio definitivo HTTPS':env.APP_URL==='https://badgewars.com',
 'Entorno Live explícito':env.DODO_PAYMENTS_ENVIRONMENT==='live_mode',
 'Interruptor instalado (false = preparado sin cobros)':['false','true'].includes(env.DODO_CHECKOUT_ENABLED),
 'Aprobación Dodo registrada':configured(env.DODO_LIVE_APPROVAL_REFERENCE),
 'Clave del entorno Live':apiKeyReady(env.DODO_PAYMENTS_API_KEY,'live_mode'),
 'Negocio Live':providerId(env.DODO_BUSINESS_ID,'bus'),
 'Producto de referencia EUR':providerId(env.DODO_PRODUCT_ID_EUR,'pdt'),
 'Firma del webhook':configured(env.DODO_PAYMENTS_WEBHOOK_KEY),
 'Identificador del webhook':configured(env.DODO_WEBHOOK_ID),
 'Turnstile y titular preparados':paymentsReady({...env,DODO_CHECKOUT_ENABLED:'true'})
};}
export function webhookMatches(webhook,env){
 return Boolean(webhook?.id===env.DODO_WEBHOOK_ID&&webhook.url==='https://badgewars.com/api/dodo/webhook'&&webhook.disabled!==true&&(!webhook.filter_types?.length||paymentEvents.every(type=>webhook.filter_types.includes(type))));
}
export async function inspectLive(env,client=dodoClient(env)){
 if(!Object.values(liveChecks(env)).every(Boolean))throw Error('incomplete_live_configuration');
 const product=await client.products.retrieve(env.DODO_PRODUCT_ID_EUR);
 const activeIds=new Set();
 for await(const product of client.products.list({archived:false}))activeIds.add(product.product_id);
 const webhook=await client.webhooks.retrieve(env.DODO_WEBHOOK_ID);
 const previews=await Promise.all([['USD','US'],['JPY','JP']].map(async([currency,country])=>{
  const preview=await client.checkoutSessions.preview({product_cart:[{product_id:env.DODO_PRODUCT_ID_EUR,quantity:5}],billing_currency:currency,billing_address:{country}});
  return preview.currency===currency&&Number.isSafeInteger(preview.current_breakup?.total_amount)&&preview.current_breakup.total_amount>0;
 }));
 return {
  'Producto único: 1 BC = 1 EUR base, SaaS, activo':productMatches(product,env,'eur')&&product.tax_category==='saas'&&activeIds.has(product.product_id),
  'Adaptive Currency: vistas previas USD y JPY sin crear pedidos':previews.every(Boolean),
  'Webhook permanente y eventos completos':webhookMatches(webhook,env)
 };
}
const parse=text=>Object.fromEntries(text.split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
async function main(){
 const args=process.argv.slice(2),n=args.indexOf('--vars'),file=n<0?'.dev.vars.dodo-live':args[n+1];
 if(args.some(a=>!['--vars','--offline',file].includes(a)))throw Error('Use --offline and/or --vars <private-file>');
 const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
 let shared={},live={};try{shared=parse(await readFile('.dev.vars.production','utf8'));}catch{}
 try{live=parse(await readFile(file,'utf8'));}catch{}
 const env={...config.vars,...shared,...live,...process.env},checks=liveChecks(env);
 console.log('Preparación Dodo Live: SOLO LECTURA. No activa ni realiza cobros.');
 for(const [label,ok] of Object.entries(checks))console.log(`${ok?'OK':'PENDING'}  ${label}`);
 let passed=Object.values(checks).every(Boolean);
 if(passed&&!args.includes('--offline')){
  try{const remote=await inspectLive(env);for(const [label,ok] of Object.entries(remote))console.log(`${ok?'OK':'PENDING'}  ${label}`);passed=Object.values(remote).every(Boolean);}
  catch(error){console.log(`PENDING  Verificación remota (${Number.isInteger(error.status)?'HTTP '+error.status:'fallo de conexión/configuración'}). No se imprimen respuestas del proveedor.`);passed=false;}
 }
 console.log(`Nuevas recargas según esta configuración local: ${paymentsReady(env)?'HABILITADAS':'PAUSADAS'}.`);
 console.log('No acredita el despliegue remoto, la entrega del webhook ni una compra real. Ver docs/dodo-live-activation.md.');
 if(!passed)process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('No se pudo leer la configuración. No se han modificado recursos.');process.exitCode=2;});
