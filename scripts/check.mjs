import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
let count=0;
for(const dir of ['src','public','scripts'])for(const file of readdirSync(dir).filter(f=>/\.m?js$/.test(f))){const result=spawnSync(process.execPath,['--check',`${dir}/${file}`],{encoding:'utf8'});if(result.status){process.stderr.write(result.stderr);process.exit(result.status);}count++;}
console.log(`${count} syntax checks passed.`);
