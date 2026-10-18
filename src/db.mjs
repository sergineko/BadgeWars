export const primary=env=>env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
export const statement=(db,sql,args=[])=>db.prepare(sql).bind(...args);
export const first=(db,sql,args=[])=>statement(db,sql,args).first();
export const rows=async(db,sql,args=[])=>((await statement(db,sql,args).all()).results||[]);
export const run=(db,sql,args=[])=>statement(db,sql,args).run();
export async function throttle(db,key,limit=20,seconds=60){
 const window=Math.floor(Date.now()/1000/seconds),row=await statement(db,`INSERT INTO bw_throttle(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN bw_throttle.window=excluded.window THEN bw_throttle.count+1 ELSE 1 END RETURNING count`,[key,window]).first();
 return row.count<=limit;
}
