# Cuentas propias y dominio

## Decisión y estado del 19 de octubre de 2026

Se centraliza la autenticación por contraseña en Workers y D1, sin Firebase. Por petición del titular, **Workers Free se mantiene**. Google ya está en producción y GitHub operativo. Correo/contraseña está implementado y probado con D1, pero antes de habilitarlo públicamente hay que activar Paid, comprobar CPU y verificar Email Sending. `EMAIL_AUTH_ENABLED=false` es la configuración de despliegue actual; el formulario ofrece alternativas sociales en vez de solicitar credenciales que no puede tramitar.

- Namecheap conserva el registro de `badgewars.com`. Nameservers `jay.ns.cloudflare.com` y `ziggy.ns.cloudflare.com` efectivos. El Worker sirve el dominio raíz y `www` con certificado válido. Los dos registros de parking se sustituyeron con autorización del titular; correo conservado. `www` redirige con 308 a HTTPS raíz conservando la ruta y los parámetros técnicos; la aplicación limpia filtros e idioma.
- D1 dedicada `badgewars`, UUID `6fb4d88f-8d52-432d-968e-0832b481eb81`, jurisdicción Unión Europea. Nueve migraciones aplicadas en remoto. La 0009 baja solo la base de Flex a 1 BC, sin modificar niveles, inventario o saldos existentes.
- KV `badgewars-public`, ID `f452a6607f9b4ce0a4050ef689873cb8`, inicializado por cron para las cinco familias. API y SVG públicos comprobados. No contiene saldo, email ni credenciales.
- Email Routing de Cloudflare sustituye los MX/SPF iniciales de Namecheap, con DKIM. Destino profesional verificado y regla activa `support@badgewars.com` hacia el buzón profesional del titular. Sin catch-all. El titular completó la verificación de Google recibida por ese alias. No es un buzón independiente ni habilita por sí solo envío SMTP.
- GitHub OAuth «BadgeWars»: callback exacto `https://badgewars.com/api/auth/callback/github`, sin wildcard ni Device Flow. Claves cargadas como secretos del Worker. Acceso real completado y colección privada con saldo cero comprobada.
- Proyecto Google Cloud `badgewars` sin facturación. Cuenta profesional `support@badgewars.com`, contacto público y desarrollador con esa dirección. Cliente web con callback exacto `https://badgewars.com/api/auth/callback/google`; enlaces de inicio/privacidad/términos revisados. **Publicado En producción el 19 de octubre** para usuarios externos. Inicio real con una cuenta fuera de la anterior lista de prueba, colección privada con cero BC y cierre de sesión comprobados. Solicita solo `openid profile`; no solicita Gmail, contactos ni permisos sensibles/restringidos. GitHub también se ha vuelto a probar. Las cuentas permanecen independientes y no se han añadido créditos.
- Worker `badgewars` desplegado con Assets, D1, KV, secretos y cron `*/5 * * * *`. Inicio OAuth con PKCE S256 y cookies Secure/HttpOnly verificado. El token temporal de preparación caduca el 19 de octubre; no forma parte de los secretos del Worker ni del repositorio.
- Turnstile «BadgeWars Production» creado en modo gestionado, con `badgewars.com` como único hostname configurado y sin preautorización de otras reglas. Clave pública en Wrangler y secreto en Workers; copia privada local excluida de Git. Token real aceptado en el Worker y reutilización/token falso rechazados. [Prueba y límites](turnstile-verification.md). Esto no activa por sí solo pagos ni correo/contraseña.

## Variables y activación final

Secretos independientes: `AUTH_COOKIE_SECRET`, `PASSWORD_PEPPER` (ambos aleatorios, al menos 32 caracteres). El pepper se custodia separado de D1 y fuera de Git. Perderlo impide comprobar hashes existentes; los usuarios tendrán que recuperar su acceso por email. No rotarlo sin plan de migración/recuperación.

Variables: `EMAIL_FROM=no-reply@badgewars.com`, `EMAIL_AUTH_ENABLED=true` **solo al completar el alta Paid y las pruebas**. Binding nativo `EMAIL`, limitado a ese remitente. Mantener `remote` ausente en desarrollo: el simulador escribe emails en ficheros locales, no los envía. Nunca publicar esos ficheros ni los logs locales de QA.

Al activar Paid, añadir a `wrangler.jsonc` `"limits":{"cpu_ms":1000}`; el presupuesto de CPU no es un límite de factura. Configurar alertas de uso para toda la cuenta, incluido cualquier otro Worker. Medir carga y memoria antes de admitir volumen real; el hash scrypt ocupa unos 64 MiB y cuesta alrededor de 180–250 ms en las pruebas locales, no una garantía de CPU facturada en producción.

Dar de alta **Email Sending** para badgewars.com: verificar los registros de autenticación que indique Cloudflare, incluidos `cf-bounce`, DKIM y DMARC. Routing de entrada y Sending de salida son configuraciones distintas. No sobrescribir SPF raíz con dos registros SPF. Verificar aceptación y entrega en bandeja/spam de mensajes solicitados, errores y supresiones. Revisar el Reply-To/SMTP de soporte antes de prometer respuestas desde el dominio.

El panel real de Cloudflare muestra **«El envío de correos electrónicos solo está disponible actualmente con el plan Workers Paid»** y solo permite contratar Paid. No permite preparar desde Free el alta del dominio de envío ni obtener sus registros DKIM. No se han inventado registros DNS ni contratado servicios. La captura de esa dependencia y las de Google se conservan en `artifacts/`, ignoradas por Git.

### Activación tras contratar Paid

La dependencia del bloque A es única: la decisión de contratar Paid. Su cierre técnico posterior requiere estas comprobaciones, no una nueva implementación de autenticación:

1. Dar de alta `badgewars.com` en Email Sending y verificar los registros DNS exactos que genere Cloudflare. Conservar Email Routing de entrada.
2. Mantener el remitente preparado `no-reply@badgewars.com`, el binding limitado `EMAIL` y los secretos existentes. Añadir `"limits":{"cpu_ms":1000}` a Wrangler y comprobar el consumo real de scrypt. Free tiene 10 ms de CPU por petición; la necesidad de Paid no depende solo del volumen de visitas.
3. Probar entrega real a buzones controlados, registro, confirmación, recuperación y errores; repetir las pruebas de Turnstile. Los límites por IP/email, el honeypot y la verificación de buzón ya están implementados.
4. Activar `EMAIL_AUTH_ENABLED=true` al confirmar esos resultados y desplegar. Si falla entrega/CPU, mantener o devolver el flag a `false`; Google y GitHub siguen disponibles.

Fuente: [límites de CPU de Workers](https://developers.cloudflare.com/workers/platform/limits/) y [Email Service: salida a usuarios requiere Paid](https://developers.cloudflare.com/email-service/platform/pricing/). No se ha realizado una contratación ni se declara probada la entrega transaccional real.

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

`node --test tests/email-auth-d1.test.mjs` valida activación, pre-registro hostil, repetición/caducidad, revocación, origen, Turnstile, límites, fallo de correo y carreras. `node scripts/qa-email-auth.mjs`, con Wrangler local en 8788 y claves oficiales de prueba, comprueba el flujo completo con D1/workerd, scrypt y email simulado. Requiere aplicar las nueve migraciones en la D1 **local** asociada a la configuración actual; los IDs nuevos generan un estado local distinto al antiguo placeholder.

Antes de producción: QA con entrega real, sesiones Google/GitHub definitivas, recuperación desde otro dispositivo, cambio de contraseña durante login y vigilancia de abusos. La cuenta Google con email existente debe crearla el titular, incluida contraseña y aceptación de condiciones; [Google exige cuenta o grupo administrado para soporte OAuth](https://support.google.com/cloud/answer/15549049?hl=en).
