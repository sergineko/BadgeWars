# Verificación de Turnstile de producción

Comprobado el **19 de octubre de 2026** en `https://badgewars.com`. Corresponde al cuarto paso de la lista de prioridades comunicada al titular y a **L05** de la [tabla de lanzamiento](review-and-launch.md).

## Configuración aplicada

- Widget Cloudflare **BadgeWars Production**, modo **gestionado** y único hostname configurado `badgewars.com`. `www` sigue redirigiendo al dominio canónico.
- Sin preautorización: superar este widget no permite omitir otras reglas de seguridad del dominio.
- `TURNSTILE_SITE_KEY` pública en `wrangler.jsonc`; `TURNSTILE_SECRET_KEY` como secreto de Workers. Copia local en `.dev.vars.production`, ignorada por Git. Ningún secreto ni token de desafío se incluye en este informe.
- Workers Free conservado. `EMAIL_AUTH_ENABLED=false`, Google/GitHub y Dodo `test_mode` conservados. No se han activado recargas reales ni registro por contraseña.

## Prueba externa realizada

Se publicó temporalmente una página de QA en el dominio real y un endpoint de comprobación que exigía sesión válida, origen propio y límite por cuenta. El widget se cargó usando el mismo módulo del frontend que las recargas. El Worker llamó a la función de producción `verifyChallenge` con la identidad de la sesión, `action=wallet-topup` y `cData` igual al ID del usuario. No se crearon checkouts ni se modificaron saldos.

| Caso | Respuesta real del Worker | Resultado |
|---|---|---|
| Token emitido por el widget de producción | HTTP 200, `accepted: true` | Aceptado tras Siteverify y coincidencia de dominio, operación y usuario |
| Segundo uso del mismo token | HTTP 403, `accepted: false` | Rechazado |
| Cadena falsa con longitud válida | HTTP 403, `accepted: false` | Rechazada |

La captura y el informe JSON sin tokens se conservan en `artifacts/turnstile-production-verification.*`, fuera de Git. La página y el endpoint de QA se retiraron mediante el despliegue normal: no forman parte del código publicado en el repositorio.

Despliegue definitivo: `13351bf8-7407-40a1-a0fc-cdb61fb0b544`. La comprobación posterior confirma clave pública disponible en `/api/auth/config`, proveedores Google/GitHub conservados, correo por contraseña desactivado, inicio HTTP 200 y endpoint temporal HTTP 404. La ruta temporal de página vuelve al comportamiento normal de la SPA y ya no sirve el contenido de QA.

## Validaciones del código

`verifyChallenge` exige éxito booleano de Siteverify, hostname exacto de `APP_URL`, action esperada y cData del usuario de la sesión (o `auth` en los formularios de correo). También rechaza solicitudes de un origen de URL distinto, valores ausentes, tokens sobredimensionados, errores HTTP, JSON inválido y fallos de red/timeout. Las claves oficiales ficticias solo se admiten en loopback, con entorno test explícito y su token documentado.

**64 pruebas automáticas y 49 comprobaciones de sintaxis superadas.** Los tests adicionales cubren dominio/operación/usuario incorrectos, replay, valores malformados, fallos del proveedor y preservación de la separación entre local y producción. Las respuestas de Siteverify se simulan para esos casos adversos; la tabla anterior recoge las tres comprobaciones con Cloudflare real.

## Alcance y mantenimiento

Esto cierra la configuración antibots. Las recargas comerciales siguen dependiendo de la aprobación y recursos live de Dodo; el registro por contraseña, de Workers Paid y correo saliente verificado. Sus formularios deben probarse de nuevo al activar esas funciones; no se han habilitado para realizar esta prueba.

Si falla el desafío, la aplicación rechaza la operación y permite repetirla con un token nuevo. No registrar el secreto, el token completo ni respuestas privadas de usuarios. Tras rotar claves o cambiar dominio, repetir la prueba real y revisar el panel de validaciones de Turnstile.

Referencia: [validación oficial de tokens de Cloudflare](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). La verificación de servidor es obligatoria; los tokens son de un solo uso y caducan a los cinco minutos.
