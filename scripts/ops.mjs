// Operator-only CLI through Wrangler's existing authentication. No admin HTTP API.
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {reviewIncident,operationalStatus,runtime} from '../src/operations.mjs';
const [command='status',...args]=process.argv.slice(2),option=name=>{const n=args.indexOf(name);return n<0?undefined:args[n+1];};
const remote=args.includes('--remote'),local=args.includes('--local');
if(remote===local)throw Error('Choose exactly one target: --remote or --local');
const config=option('--config')||'wrangler.jsonc',cfg=JSON.parse(await readFile(config,'utf8')),database=cfg.d1_databases.find(d=>d.binding==='DB').database_name;
const quote=value=>value===null?'NULL':typeof value==='number'&&Number.isFinite(value)?String(value):"'"+String(value).replaceAll("'","''")+"'";
function execute(sql){
 const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute',database,remote?'--remote':'--local','--config',config,...(option('--persist-to')?['--persist-to',option('--persist-to')]:[]),'--command',sql,'--json'],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:process.env.WRANGLER_LOG_PATH||'artifacts/ops-wrangler.log',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||process.cwd()+'/.wrangler/cf-config'}});
 if(r.status)throw Error('Wrangler operation failed; inspect local log');return JSON.parse(r.stdout);
}
const db={prepare(sql){return {sql,args:[],bind(...args){return {...this,args};},render(){let i=0;const result=this.sql.replace(/\?/g,()=>quote(this.args[i++]));if(i!==this.args.length)throw Error('Invalid query parameters');return result;},async run(){return execute(this.render())[0];},async first(){return execute(this.render())[0].results[0]||null;},async all(){return execute(this.render())[0];}};},async batch(statements){return execute(statements.map(s=>s.render()).join(';'));}};
if(command==='status')console.log(JSON.stringify({status:await operationalStatus(db),scheduler:await runtime(db,'scheduler'),publisher:await runtime(db,'publisher'),quota:await runtime(db,'quota')},null,2));
else if(command==='list')console.log(JSON.stringify(execute("SELECT id,kind,reference,state,occurrences,last_seen,created_at FROM bw_operations WHERE state<>'resolved' ORDER BY created_at LIMIT 50")[0].results,null,2));
else if(command==='review'){
 const id=option('--id'),state=option('--state'),actor=option('--actor'),note=option('--note'),occurrence=Number(option('--occurrence'));
 await reviewIncident(db,id,state,actor,note,occurrence);console.log('Case review recorded. Financial and access records were not modified.');
}else throw Error('Commands: status, list, review. See docs/operations-runbook.md');
