// Native Miniflare export for an explicit local persistence directory.
// Wrangler's d1 export --local currently does not expose --persist-to.
import {createRequire} from 'node:module';
import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const [configPath,persistencePath,outputPath]=process.argv.slice(2);
if(!configPath||!persistencePath||!outputPath)throw Error('Usage: node scripts/export-local-d1.mjs CONFIG PERSIST_TO OUTPUT');
if(await access(outputPath).then(()=>true,()=>false))throw Error('Refusing to overwrite an existing backup');
const config=JSON.parse(await readFile(configPath,'utf8')),id=config.d1_databases.find(d=>d.binding==='DB')?.database_id;
const require=createRequire(resolve('node_modules/wrangler/package.json')),{Miniflare,convertV4MiniflareOptions}=require('miniflare');
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {}',resourcePersistencePath:resolve(persistencePath,'v3'),d1Databases:{DATABASE:id}}));
try{const db=await mf.getD1Database('DATABASE'),dump=await db.prepare('PRAGMA miniflare_d1_export(?,?,?);').bind(false,false).raw();await writeFile(outputPath,dump[0].join('\n'),{mode:0o600});console.log('Native local D1 export saved privately.');}finally{await mf.dispose();}
