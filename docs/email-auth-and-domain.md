# Cuentas propias y dominio

## Decisión y estado del 18 de octubre de 2026

Se centraliza la autenticación por contraseña en Workers y D1, sin Firebase. Por petición del titular, **Workers Free se mantiene durante la preparación**. Antes de habilitar correo/contraseña públicamente hay que activar Paid, comprobar CPU y verificar Email Sending. `EMAIL_AUTH_ENABLED=false` es la configuración de despliegue actual; no anunciar todavía ese acceso como operativo en Internet.

- Namecheap conserva el registro de `badgewars.com`. Nameservers guardados: `jay.ns.cloudflare.com` y `ziggy.ns.cloudflare.com`. La delegación necesita propagación y comprobación de zona/certificado antes del lanzamiento.
- D1 dedicada `badgewars`, UUID `6fb4d88f-8d52-432d-968e-0832b481eb81`, creada con jurisdicción Unión Europea. **No se han aplicado migraciones remotas**.
- KV `badgewars-public`, ID `f452a6607f9b4ce0a4050ef689873cb8`, creado para proyecciones públicas. No contiene saldo, email ni credenciales; aún no está inicializado en remoto.
- Se han sustituido los MX/SPF iniciales de Namecheap por Email Routing de Cloudflare, con DKIM. Destino profesional verificado y regla activa `support@badgewars.com` hacia el buzón profesional del titular. Sin catch-all. No es un buzón independiente ni habilita por sí solo el envío SMTP; comprobar recepción externa antes de publicar el contacto.
- GitHub OAuth «BadgeWars» creado con callback exacto `https://badgewars.com/api/auth/callback/github`, sin wildcard ni Device Flow. Secreto guardado en `.dev.vars.production`, ignorado por Git. Falta cargarlo en Worker y probar una sesión real.
- Proyecto Google Cloud `badgewars` creado sin facturación. El contacto público se preparará con `support@badgewars.com`; no se ha publicado el Gmail personal. Faltan cuenta Google profesional, permisos del proyecto, consentimiento y cliente web.

## Variables y activación final

Secretos independientes: `AUTH_COOKIE_SECRET`, `PASSWORD_PEPPER` (ambos aleatorios, al menos 32 caracteres). El pepper se custodia separado de D1 y fuera de Git. Perderlo impide comprobar hashes existentes; los usuarios tendrán que recuperar su acceso por email. No rotarlo sin plan de migración/recuperación.

Variables: `EMAIL_FROM=no-reply@badgewars.com`, `EMAIL_AUTH_ENABLED=true` **solo al completar el alta Paid y las pruebas**. Binding nativo `EMAIL`, limitado a ese remitente. Mantener `remote` ausente en desarrollo: el simulador escribe emails en ficheros locales, no los envía. Nunca publicar esos ficheros ni los logs locales de QA.

Al activar Paid, añadir a `wrangler.jsonc` `"limits":{"cpu_ms":1000}`; el presupuesto de CPU no es un límite de factura. Configurar alertas de uso para toda la cuenta, incluido cualquier otro Worker. Medir carga y memoria antes de admitir volumen real; el hash scrypt ocupa unos 64 MiB y cuesta alrededor de 180–250 ms en las pruebas locales, no una garantía de CPU facturada en producción.

Dar de alta **Email Sending** para badgewars.com: verificar los registros de autenticación que indique Cloudflare, incluidos `cf-bounce`, DKIM y DMARC. Routing de entrada y Sending de salida son configuraciones distintas. No sobrescribir SPF raíz con dos registros SPF. Verificar aceptación y entrega en bandeja/spam de mensajes solicitados, errores y supresiones. Revisar el Reply-To/SMTP de soporte antes de prometer respuestas desde el dominio.

Según la documentación consultada, Workers Paid parte de 5 USD/mes más uso e impuestos; Email Sending incluye 3.000 mensajes mensuales y cobra el exceso. La aplicación limita sus intentos a 80 diarios y 2.400 por ventanas de 31 días; no reserva la cuota frente a otros servicios de la cuenta. Fuentes: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Email Service](https://developers.cloudflare.com/email-service/platform/pricing/), [configuración de salida](https://developers.cloudflare.com/email-service/get-started/send-emails/).

## Garantías de autenticación

- Scrypt nativo mediante `node:crypto`, N=65536, r=8, p=2, sal aleatoria de 32 bytes y prehash HMAC con pepper; comparación constante. Contraseñas de 15 a 128 caracteres Unicode. El acceso de una dirección inexistente también calcula un hash equivalente. Un hash simultáneo por isolate evita acumulación local de memoria.
- Turnstile comprueba hostname, action específica y cData `auth`; honeypot, cuerpo máximo de 8 KiB, límites por IP/email con hash y presupuestos de correo. Los dummy keys solo funcionan en loopback y Sandbox.
- Una cuenta pendiente no crea usuario público ni monedero. Confirmar requiere enlace y contraseña elegida al registrarse, evitando activación de credenciales de un tercero que se anticipó al registro.
- Códigos aleatorios de 256 bits, hash en D1, caducidad de 30 minutos, versión de credenciales y consumo atómico. Reenviar/repetir registro invalida enlaces previos; un envío obsoleto no elimina un enlace más reciente. Pendientes sin verificar se depuran tras siete días.
- La recuperación cambia hash/versión, consume códigos y elimina todas las sesiones en una operación SQL con triggers. Un login que compite con la recuperación debe validar de nuevo versión/hash al insertar sesión.
- Sesiones opacas HttpOnly/SameSite=Lax/Secure. Email y códigos no entran en rankings/SVG. Los enlaces nuevos llevan el código en fragmento para excluirlo de HTTP/Referer; la aplicación lo conserva solo en memoria y limpia la URL. Formularios y respuestas privadas usan `no-store`.
- Cada método identifica una cuenta distinta; no se fusionan saldos por coincidencia de email.

## Pruebas

`node --test tests/email-auth-d1.test.mjs` valida activación, pre-registro hostil, repetición/caducidad, revocación, origen, Turnstile, límites, fallo de correo y carreras. `node scripts/qa-email-auth.mjs`, con Wrangler local en 8788 y claves oficiales de prueba, comprueba el flujo completo con D1/workerd, scrypt y email simulado. Requiere aplicar las ocho migraciones en la D1 **local** asociada a la configuración actual; los IDs nuevos generan un estado local distinto al antiguo placeholder.

Antes de producción: QA con entrega real, sesiones Google/GitHub definitivas, recuperación desde otro dispositivo, cambio de contraseña durante login y vigilancia de abusos. La cuenta Google con email existente debe crearla el titular, incluida contraseña y aceptación de condiciones; [Google exige cuenta o grupo administrado para soporte OAuth](https://support.google.com/cloud/answer/15549049?hl=en).
