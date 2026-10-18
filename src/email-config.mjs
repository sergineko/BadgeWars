export function emailReady(env){
 try{const url=new URL(env.APP_URL),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname),dummy=/^[123]x0+/.test(env.TURNSTILE_SITE_KEY||'')||/^[123]x0+/.test(env.TURNSTILE_SECRET_KEY||'');return Boolean(env.EMAIL_AUTH_ENABLED==='true'&&env.DB&&env.AUTH_COOKIE_SECRET?.length>=32&&env.PASSWORD_PEPPER?.length>=32&&env.EMAIL?.send&&/^[a-z0-9._+-]+@badgewars\.com$/i.test(env.EMAIL_FROM||'')&&env.TURNSTILE_SECRET_KEY&&env.TURNSTILE_SITE_KEY&&(url.protocol==='https:'||local)&&(!dummy||local&&env.POLAR_ENVIRONMENT==='sandbox'));}catch{return false;}
}
