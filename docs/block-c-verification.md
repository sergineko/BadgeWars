# Bloque C · Operación y seguridad

Comprobado el **19 de octubre de 2026**, desplegado en la versión `2e06ca6b-0298-41d9-b3e3-4f33c418c8c2`. Workers continúa en **Free**. Los cobros públicos y el acceso por correo/contraseña permanecen desactivados. Este bloque no modifica la política comercial ni sustituye la aceptación de Dodo o el cierre legal/fiscal.

| Control | Resultado comprobado |
|---|---|
| Seguimiento operativo | Tres tareas periódicas separan conciliación, publicación y monitorización para limitar consultas por ejecución. Se observaron ejecuciones reales de las tres en producción. |
| Incidencias | Contadores de expedientes, webhooks, recargas inciertas, reservas, bloqueos y proyecciones atrasadas. El caso de autocomprobación se cerró mediante la CLI y conserva su evento de revisión; ninguna tabla financiera se modificó. |
| Aviso por correo | El transporte de Cloudflare aceptó el aviso de autocomprobación y el posterior aviso de recuperación, con identificadores distintos; el estado quedó sin incidencias y sin lease pendiente. La aceptación del transporte no prueba por sí sola su llegada a la bandeja de entrada. Solo se envían contadores y el procedimiento al destino profesional verificado. |
| Cuotas | Consulta real de Analytics aceptada con el token exclusivo `Account Analytics: Read`, limitado a la cuenta. Un intento de consulta D1 con ese mismo token devolvió **403**. Umbrales 80/95 % y estado desconocido ante errores; incluye consumo de otros proyectos de la cuenta. |
| Salud y monitor externo | `/api/health`, arena sin demo y SVG Flex/Trust/Genesis comprobados en el dominio público. [Ejecución real de Actions correcta](https://github.com/sergineko/BadgeWars/actions/runs/39292796876), con checkout v6 fijado por SHA y sin persistir credenciales. Workflow horario sin secretos Cloudflare/Dodo. Las notificaciones siguen las preferencias de GitHub del titular. |
| Copia de producción | Exportación D1 importada en una base local distinta; tres cuentas y cero registros financieros, sin violaciones de claves foráneas. Copia cifrada con DPAPI del perfil Windows, con descifrado/hash verificados. No se restauró ni sustituyó producción. |
| Restauración financiera aislada | Export/import nativo en dos bases/KV locales distintas. Mantenimiento impide el gasto y acepta webhooks firmados sin entregar BC. Conciliación de una devolución EUR existente mediante lecturas reales de Dodo **test**, sin nuevos cobros ni devoluciones externas. |
| Credenciales temporales | Revocadas `BadgeWars Test QA 2026-10-19` de Dodo y `BadgeWars setup — expires 2026-10-19` de Cloudflare, con autorización del titular. Ambas dejaron de autenticar (**401**). Webhook de QA desactivado. Google, GitHub, Turnstile y el OAuth de mantenimiento de Wrangler se conservan. |
| Regresión | **76 pruebas** y **61 comprobaciones de sintaxis** correctas; revisión de espacios del diff sin errores. |

## Resultado del ensayo financiero

El punto de partida es una **instantánea controlada que representa el estado anterior a una devolución**, construida con referencias de los pagos de test del bloque B. No se presenta como una copia histórica tomada realmente antes de aquella devolución. Se exportó e importó D1 mediante el runtime nativo, conservando ledger, consentimientos y referencias.

| Cuenta ficticia | Antes de conciliar | Después de restaurar y conciliar |
|---|---|---|
| Empresa EUR | 5 BC recargados, 1 consumido: saldo 4, dos asientos, badge activo | Devolución externa existente de 2 €: saldo 2, tres asientos, cuenta en revisión y badge suspendido |
| Cuenta `force_3ds` USD | 5 BC recargados, 2 consumidos: saldo 3, dos asientos, badge activo | Saldo 3, dos asientos, badge activo |

Una segunda conciliación no añadió asientos ni duplicó la reversión. Se invalidaron autorizaciones restauradas y reconstruyeron las cinco familias KV. El SVG suspendido devuelve una tarjeta inactiva, sin propietario/rango; el activo conserva su titular. El ranking reconstruido excluye la cuenta suspendida. El ensayo no liberó automáticamente una cuenta en revisión.

## Límites y mantenimiento

- D1 Time Travel conserva **siete días en Free**. DPAPI requiere el mismo perfil Windows y no constituye un archivo portable fuera de ese equipo. Se exporta antes de migraciones/intervenciones; no se ha contratado almacenamiento adicional.
- Restaurar D1 no revierte pagos externos. Los consumos internos posteriores a una copia no pueden reconstruirse únicamente desde Dodo: hay que conservar y revisar su evidencia antes de reabrir.
- Las métricas pueden tener retraso; los umbrales y la comprobación horaria no garantizan evitar todos los picos. El monitor externo permite detectar una caída que impida enviar el correo desde Cloudflare.
- `PRAGMA integrity_check` no está disponible a través de la API D1 empleada. Se comprobaron claves foráneas, saldos/ledger, referencias e idempotencia; no se afirma haber ejecutado ese PRAGMA remoto.
- Las evidencias completas, exports y capturas de cuentas quedan fuera de Git. Los documentos públicos no contienen secretos, facturas, datos bancarios ni cuerpos de webhooks.

Procedimiento de uso: [operación y recuperación](operations-runbook.md). Estado global sin nuevos bloques: [plan A–E](review-and-launch.md).
