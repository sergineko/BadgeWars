import {readFile,writeFile} from 'node:fs/promises';
import DodoPayments from 'dodopayments';
const dir='.wrangler/dodo-qa-b',config=Object.fromEntries((await readFile('.dev.vars.dodo-test','utf8')).split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^['"]|['"]$/g,'')]));
if(config.DODO_PAYMENTS_ENVIRONMENT!=='test_mode')throw Error('Test mode only');
const client=new DodoPayments({bearerToken:config.DODO_PAYMENTS_API_KEY,environment:'test_mode',maxRetries:0}),checkouts=JSON.parse(await readFile(dir+'/checkouts.json','utf8')),report={};
for(const [name,item] of Object.entries(checkouts)){
 const session=await client.checkoutSessions.retrieve(item.sessionId||item.url.split('/').pop());
 if(!session.payment_id){report[name]={state:'no payment'};continue;}
 const payment=await client.payments.retrieve(session.payment_id);
 await writeFile(dir+'/payment-'+name+'.json',JSON.stringify(payment,null,2),{mode:0o600});
 report[name]={paymentId:payment.payment_id,status:payment.status,errorCode:payment.error_code,currency:payment.currency,total:payment.total_amount,tax:payment.tax??0,invoiceAvailable:Boolean(payment.invoice_url)};
}
await writeFile('artifacts/block-b-payment-status.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
