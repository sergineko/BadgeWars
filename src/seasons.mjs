import {first,rows,run} from './db.mjs';

// Database time is authoritative. A delayed cron never extends the spending window.
export async function closeDueSeasons(db){
 return run(db,"UPDATE bw_flex_seasons SET status='closed',closed_at=ends_at,operator_actor='system',operator_note='Scheduled deadline' WHERE status='open' AND ends_at IS NOT NULL AND julianday(ends_at)<=julianday('now')");
}
export async function currentSeason(db){return first(db,"SELECT * FROM bw_flex_seasons ORDER BY number DESC LIMIT 1");}
export async function seasons(db){return rows(db,'SELECT id,number,design,name,starts_at AS startsAt,ends_at AS endsAt,status,closed_at AS closedAt FROM bw_flex_seasons ORDER BY number DESC');}
