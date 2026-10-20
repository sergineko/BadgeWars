// Register an actual new SVG design here before opening another season.
export const flexDesigns={'apex-1':{color:'#bf8aff'}};
export function seasonState(season,now=Date.now()){
 if(!season)return 'unknown';
 if(season.status==='closed'||season.endsAt&&Date.parse(season.endsAt)<=now)return 'closed';
 return season.endsAt?'countdown':'open';
}
export function seasonRemaining(season,now=Date.now()){
 if(!season?.endsAt)return null;
 const seconds=Math.max(0,Math.ceil((Date.parse(season.endsAt)-now)/1000));
 return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
}
