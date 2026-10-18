import {TERMS_VERSION} from '../../public/terms.js';
export const consent={accepted:true,executionRequested:true,withdrawalAcknowledged:true,termsVersion:TERMS_VERSION};
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function createD1(path=':memory:'){
 const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 const db={sqlite,withSession(){return this;},prepare(sql){return {sql,args:[],bind(...args){return {...this,args};},_execute(){const s=sqlite.prepare(this.sql);if(s.columns().length)return {success:true,results:s.all(...this.args),meta:{changes:0}};const r=s.run(...this.args);return {success:true,results:[],meta:{changes:Number(r.changes)}};},async first(column){const row=this._execute().results[0];return column?row?.[column]??null:row??null;},async all(){return this._execute();},async run(){return this._execute();}};},async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s._execute());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}},async exec(sql){sqlite.exec(sql);},close(){sqlite.close();}};
 for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('migrations/'+file,'utf8'));
 return db;
}
export async function seedUser(db,{id=crypto.randomUUID(),credits=0,name='Collector'}={}){
 await db.prepare('INSERT INTO bw_users(id,provider,subject,name) VALUES(?,?,?,?)').bind(id,'github',id,name).run();
 if(credits)await db.prepare("INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(?,?,?,'topup',?)").bind(crypto.randomUUID(),id,credits,'seed:'+id).run();return id;
}
