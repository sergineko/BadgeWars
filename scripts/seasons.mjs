// Private operator CLI. No browser/admin endpoint can open or close a season.
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {flexDesigns} from '../public/seasons.js';
const [command='list',...args]=process.argv.slice(2),get=name=>{const at=args.indexOf(name);return at<0?undefined:args[at+1];};
const remote=args.includes('--remote'),local=args.includes('--local');
if(remote===local)throw Error('Choose --local or --remote explicitly');
const config=get('--config')||'wrangler.jsonc',cfg=JSON.parse(await readFile(config,'utf8')),database=cfg.d1_databases.find(d=>d.binding==='DB').database_name;
const sql=value=>"'"+String(value).replaceAll("'","''")+"'";
function execute(query){
 const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute',database,remote?'--remote':'--local','--config',config,...(get('--persist-to')?['--persist-to',get('--persist-to')]:[]),'--command',query,'--json'],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:process.env.WRANGLER_LOG_PATH||'artifacts/seasons-wrangler.log',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||process.cwd()+'/.wrangler/cf-config'}});
 if(result.status)throw Error('Season operation failed. Inspect the private local log.');return JSON.parse(result.stdout)[0];
}
if(command==='list'){console.log(JSON.stringify(execute('SELECT id,number,design,starts_at,ends_at,status,closed_at FROM bw_flex_seasons ORDER BY number DESC').results,null,2));}
else{
 const actor=get('--actor'),note=get('--note'),id=get('--id');
 if(!actor?.trim()||!note?.trim()||!args.includes('--confirm'))throw Error('Mutations require --actor, --note and --confirm');
 if(!/^[a-z0-9-]{1,64}$/.test(id||''))throw Error('Invalid season id');
 const audit=',operator_actor='+sql(actor)+',operator_note='+sql(note);
 if(command==='schedule'){
  const end=get('--end');if(!end||!/(Z|[+-]\d\d:\d\d)$/.test(end)||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.now())throw Error('--end requires a future ISO date with timezone');
  const result=execute('UPDATE bw_flex_seasons SET ends_at='+sql(new Date(end).toISOString())+audit+" WHERE id="+sql(id)+" AND status='open' RETURNING id,ends_at");
  if(!result.results.length)throw Error('Season is not open');console.log('Future closing date recorded. Publish the dirty projection and announce the date.');
 }else if(command==='close'){
  // Closing requires a previously announced deadline; this CLI cannot invent a retroactive one.
  const result=execute("UPDATE bw_flex_seasons SET status='closed',closed_at=ends_at"+audit+' WHERE id='+sql(id)+" AND status='open' AND ends_at IS NOT NULL AND julianday(ends_at)<=julianday('now') RETURNING id");
  if(!result.results.length)throw Error('An announced deadline must have elapsed');console.log('Season closed. Final positions are immutable.');
 }else if(command==='open'){
  const design=get('--design');if(!Object.hasOwn(flexDesigns,design||''))throw Error('Register and verify the new SVG design before opening the season');
  const result=execute('INSERT INTO bw_flex_seasons(id,number,design,name,operator_actor,operator_note) SELECT '+sql(id)+",coalesce(max(number),0)+1,"+sql(design)+','+sql(get('--name')||id)+','+sql(actor)+','+sql(note)+" FROM bw_flex_seasons HAVING NOT EXISTS(SELECT 1 FROM bw_flex_seasons WHERE status='open') RETURNING id,number,design");
  if(!result.results.length)throw Error('Close the previous season first');console.log('New independent season created. Publish the dirty projection.');
 }else throw Error('Commands: list, schedule, close, open');
}
