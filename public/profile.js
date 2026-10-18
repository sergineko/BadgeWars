export function profileImage(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<=2048?url.href:null;}catch{return null;}
}
