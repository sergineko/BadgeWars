import {comparePoints} from './points.js';
import {catalog} from './badges.js';
const handles=['pixelpilot','shipit','bytegarden','cleancode','tinybuilds','devnora','commitcat','stackmoss','loopcraft','nocturne','softlaunch'];
export const demoEntries=handles.map((owner,i)=>({id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,badgeId:'flex',badge:'The Apex Flex',owner,avatarUrl:`/avatars/demo-${i%5+1}.svg`,amount:12000-i*100,currency:'credits',status:'accepted',created_at:`2026-10-${String(16-i).padStart(2,'0')}T12:00:00Z`,rank:i+1}));
demoEntries.push({id:'20000000-0000-4000-8000-000000000001',badgeId:'funded',badge:'Build Funded',owner:'shipit',avatarUrl:'/avatars/demo-2.svg',amount:5000,currency:'credits',status:'accepted',rank:1,created_at:'2026-10-14T10:00:00Z'});
export const demoBag={id:'20000000-0000-4000-8000-000000000002',badgeId:'quality',badge:'Trust Bag',owner:'pixelpilot',avatarUrl:'/avatars/demo-1.svg',amount:2000,currency:'credits',status:'accepted',points:'287',rank:2,supporterCount:7,showTop:0,topSupporters:[],created_at:'2026-10-14T10:00:00Z'};
demoEntries.push({...demoBag,showTop:undefined,amount:undefined,currency:undefined},...['devnora','shipit'].map((owner,i)=>({id:`21000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,badgeId:'quality',badge:'Trust Bag',owner,avatarUrl:`/avatars/demo-${i+2}.svg`,points:i?'119':'938',supporterCount:i?4:12,rank:i?3:1,topSupporters:[],created_at:'2026-10-15T10:00:00Z'})));
demoEntries.push(...['earlybird','goldenbyte','origin'].map((owner,i)=>({id:`30000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,badgeId:'genesis',badge:'Genesis Edition',owner,avatarUrl:`/avatars/demo-${i+3}.svg`,amount:100000,currency:'credits',status:'accepted',edition:i+1,created_at:`2026-10-1${i+1}T09:00:00Z`})));
export const demoArena={demo:true,rankings:demoEntries,states:Object.fromEntries(catalog.map(b=>{const entries=demoEntries.filter(p=>p.badgeId===b.id).sort((x,y)=>b.id==='quality'?comparePoints(x,y):0);const top=entries[0];return [b.id,{amount:top?.amount||0,owner:['genesis','quality'].includes(b.id)?null:top?.owner,sold:b.id==='genesis'?entries.length:0,claims:entries}];}))};
export const demoCollection=[demoEntries[0],demoBag,demoEntries.find(p=>p.badgeId==='genesis')];
// Fictional private demo examples, never used in production KV projections.
export const demoSupporters=['shipit','bytegarden','devnora','commitcat','stackmoss','loopcraft','nocturne'].map((alias,i)=>({alias,points:String([100,75,50,25,20,10,7][i]),contributions:i<2?2:1,last_at:'2026-10-16T10:00:00Z'}));
export function demoVisibility(count){
 demoBag.showTop=count;demoBag.topSupporters=demoSupporters.slice(0,count).map(p=>p.alias);
 for(const entry of [demoEntries.find(p=>p.id===demoBag.id),...demoArena.states.quality.claims.filter(p=>p.id===demoBag.id)])entry.topSupporters=[...demoBag.topSupporters];
}
