# Cloudflare · configuración revisada el 21/10/2026

Revisión de la guía de inicio rápido de **badgewars.com**, manteniendo **Free**, Workers Free, el dominio en Namecheap y los registros del correo.

| Área | Estado y decisión |
|---|---|
| Transporte | HTTPS obligatorio, HTTP/2, HTTP/3 y TLS 1.3 ya habilitados. HTTP redirige a HTTPS. Se conserva **Completo**, por elección expresa del titular; no se ha guardado Completo (Estricto). |
| Rendimiento | **Early Hints y Speed Brain activados**. Speed Brain excluye rutas que invocan Workers y solo precarga contenido elegible de caché; no se promete acelerar una API ni una ruta dinámica. |
| Supervisión del navegador | **Page Shield activado**, sin reglas nuevas de bloqueo. La detección de recursos necesita tráfico y tiempo; el interruptor habilitado no prueba que ya haya recibido todos los informes. |
| Bots y formularios | Turnstile y controles de aplicación existentes. **Bot Fight Mode permanece desactivado**: en Free afecta a todo el dominio y puede desafiar consultas de API, SVG o webhooks sin permitir excepciones por ruta. |
| Credenciales filtradas | No se crea una regla de contraseñas que actualmente no se reciben: producción usa Google/GitHub y correo/contraseña continúa deshabilitado. Revisar la regla específica al habilitar ese acceso. |
| Caché | Se respetan las cabeceras de la aplicación: JSON privado y documentos `no-store`; SVG público con caché breve, SVG personal con control de suspensión. No se añade una regla de cachear todo. |
| Compatibilidad | Rocket Loader y 0-RTT permanecen desactivados. Sin transformación del orden de los módulos ni activación de early data para accesos/pagos. Las fuentes ya se sirven localmente. No se contratan Polish, APO, Pro ni Enterprise. |
| Observación y avisos | Monitor de cuota, salud y alertas operativas ya comprobados en el bloque C. La guía también enlaza a Trace, estadísticas y notificaciones; revisar esos enlaces no crea por sí mismo reglas ni tests. |

La guía es un conjunto de recomendaciones; no requiere activar todas sus opciones para cerrar la revisión. Se eligieron las compatibles con los SVG externos, OAuth y Dodo. No se habilitaron compras Live ni nuevos servicios de pago.

La revisión automática inicialmente rechazó guardar Completo (Estricto) por posible incompatibilidad de certificados. Se informó al titular y este eligió mantener Completo. No se cambió mediante una vía alternativa.

Comprobaciones finales: web y SVG devuelven 200; accesos Google/GitHub disponibles; firma válida de prueba no financiera 202 y cuerpo manipulado 403. Las recargas continúan deshabilitadas. [Preparación y activación](dodo-live-activation.md).

Fuentes: [Speed Brain y sus límites](https://developers.cloudflare.com/speed/optimization/content/speed-brain/), [Bot Fight Mode y las API](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/), [supervisión de scripts](https://developers.cloudflare.com/client-side-security/get-started/).
