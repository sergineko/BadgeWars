# Operación y recuperación de BadgeWars

Responsable: **Sergio Moreno García / SergioTech.es**. Canal de usuario: `support@badgewars.com`. Los avisos operativos van al destino profesional ya verificado de Email Routing. El suplente debe ser una persona expresamente autorizada por el titular, con su propio acceso; nunca se comparten claves por incidencias.

## Avisos y capacidad en Workers Free

| Control | Frecuencia y alcance | Actuación |
|---|---|---|
| Pagos y webhooks | Cada cinco minutos; un aviso, una recarga y un pedido por recuperación periódica. Los avisos entrantes también se procesan tras su recepción. | Revisar retrasos/reintentos antes de crear otra operación. |
| Publicación KV | Cron separado cada cinco minutos, un minuto después del financiero; cinco familias como máximo. | Conserva `dirty` ante error o presupuesto agotado. La compra también solicita publicación inmediata. |
| Incidencias | A los minutos UTC 2, 17, 32 y 47. Cuenta expedientes abiertos, webhooks atascados, recargas inciertas o con errores repetidos, reservas de devolución, monederos bloqueados y proyecciones atrasadas. | Consultar con la CLI; los correos solo contienen contadores. |
| Cuotas de la cuenta | Consulta de Analytics como máximo una vez por hora. Incluye también el consumo de otros proyectos de la misma cuenta. | Aviso al 80 %, crítico al 95 %. Decidir Paid antes del límite; ningún cambio de plan es automático. |
| Disponibilidad externa | GitHub Actions cada hora, al minuto 37; ejecución manual disponible. Sin secretos Cloudflare ni Dodo. | Verifica salud, arena real y SVG Flex/Trust/Genesis; reintenta una vez y marca fallo si persiste. Las notificaciones de Actions siguen las preferencias del titular en GitHub. |

Se observan peticiones Workers; filas D1 leídas/escritas, almacenamiento total y mayor base; operaciones KV de lectura/escritura/borrado/listado y almacenamiento KV. Se comprueba además el presupuesto **propio** de publicación de 900 escrituras/día, con avisos desde 720 y críticos desde 855. No se confunde este presupuesto con la cuota global de KV. Los límites diarios se reinician a medianoche UTC.

Las métricas del proveedor pueden llegar con retraso y algunas son adaptativas; una comprobación horaria no evita un pico entre consultas. Un error o permiso insuficiente marca el monitor como desconocido y avisa; no se convierte en consumo cero. Los correos de incidencias se agrupan por tipo y gravedad, con separación mínima de diez minutos ante un cambio y recordatorio diario mientras persistan. Una recuperación provoca un único aviso. Una entrega incierta puede repetirse; estos avisos no ejecutan movimientos financieros.

`/api/health` devuelve únicamente estado y comprobaciones de servicio, sin cuentas ni referencias de pagos. Devuelve 503 ante D1/KV indisponibles, cron/publicador sin éxito durante veinte minutos, proyecciones atrasadas o mantenimiento. Workers Issues también queda habilitado en su beta gratuita para revisar errores de ejecución y 5xx. Una caída de Cloudflare o un agotamiento completo de su cuenta puede impedir el propio aviso interno; Actions realiza la comprobación desde otro proveedor.

Fuentes: [Analytics KV](https://developers.cloudflare.com/kv/observability/metrics-analytics/), [D1](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [límites D1 y siete días de Time Travel en Free](https://developers.cloudflare.com/d1/platform/limits/), [Issues](https://developers.cloudflare.com/workers/observability/issues/) y [correo gratuito a destinos verificados](https://developers.cloudflare.com/email-service/platform/pricing/). El correo a usuarios arbitrarios continúa condicionado a Paid, según el bloque A.

## Revisión diaria y gestión de expedientes

Desde la raíz del repositorio, con Wrangler autenticado. Los comandos exigen elegir `--remote` o `--local`; no existe una API pública de administración.

```powershell
node scripts/ops.mjs status --remote
node scripts/ops.mjs list --remote
node scripts/ops.mjs review --remote --id ID --state acknowledged --actor SergioTech --occurrence 1 --note "Caso asignado; revisando referencias del proveedor"
```

1. Ante un aviso crítico, atender primero cobros no entregados, reembolsos/disputas o saldos bloqueados. Ante caída general o posible corrupción, pausar operaciones antes de modificar datos. Revisar errores de ejecución, cuotas y la hora del último cron.
2. Identificar el expediente por `id`, `kind` y `reference`. Consultar las referencias correspondientes en `bw_topups`, `bw_orders`, `bw_webhooks`, `bw_refund_requests`, `bw_wallets` y el ledger. Consultar el estado actual en Dodo antes de decidir. No vincular cuentas por email.
3. Registrar la asignación con `acknowledged`, autor y motivo. Usar el `occurrences` observado como `--occurrence`; si cambió, la CLI rechaza el cierre para evitar resolver un expediente modificado concurrentemente.
4. Resolver la causa y conservar referencias de evidencia. Una recarga incierta no se repite con una clave nueva a ciegas. Un webhook se vuelve a entregar o concilia desde su pago real. Para una devolución comercial o exigida por el proveedor, seguir [pagos y operación](payments-and-operations.md); no automatizar la salida de dinero.
5. Cerrar el expediente solo después de verificar la corrección, saldo, deuda y estado público. Registrar una nota concreta, sin claves, tarjetas, datos bancarios ni cuerpos de webhooks:

```powershell
node scripts/ops.mjs review --remote --id ID --state resolved --actor SergioTech --occurrence 1 --note "Proveedor y ledger conciliados; evidencia REF_INTERNA; comprobaciones correctas"
```

El historial de revisión es inmutable. Si la misma condición vuelve a detectarse después del cierre, se reabre con otra ocurrencia y un evento de sistema. **Cerrar un expediente no desbloquea un monedero, elimina deuda, cierra una reserva ni reactiva un badge.** Esas decisiones requieren conciliar todas las causas pendientes; no se modifica un saldo directamente ni se borran asientos para forzarlas. Una disputa ganada tampoco elimina otros bloqueos. Si la causa sigue sin resolverse, dejar el expediente abierto/asignado y documentar la dependencia real.

## Recuperación: secuencia de intervención

El plan usa Time Travel automático de D1, disponible **siete días en Free**, y exportaciones antes de migraciones/intervenciones. Una exportación no sustituye la historia de pagos externa; restaurar D1 **no devuelve ni deshace dinero en Dodo**. El ensayo se ejecuta aislado; los comandos de restauración remota son una intervención del titular y no una tarea automática.

1. **Pausar.** Generar una copia ignorada de la configuración normal con `vars.MAINTENANCE_MODE="true"`, conservando los demás bindings, vars y secretos, y desplegarla. Verificar 503 en salud/recargas/consumos/SVG. Los webhooks firmados siguen entrando en el inbox, sin entrega de BC. Los procesos financieros/publicador se pausan; el seguimiento operativo sigue activo.
2. **Conservar.** Guardar la versión del Worker, migraciones y estado actual del proveedor. Obtener el bookmark actual y exportar D1 antes de restaurar. El export puede bloquear brevemente la base; hacerlo con las operaciones pausadas. Registrar también referencias externas desde el momento de la copia, especialmente consumos internos posteriores: Dodo no puede reconstruirlos.

```powershell
node node_modules/wrangler/bin/wrangler.js d1 time-travel info badgewars --json
node node_modules/wrangler/bin/wrangler.js d1 export badgewars --remote --output .wrangler/backup-unico.sql
./scripts/protect-backup.ps1 -Mode protect -Source .wrangler/backup-unico.sql -Destination .wrangler/backup-unico.sql.dpapi
```

3. **Ensayar primero.** Importar la copia en una D1 local con UUID, nombre y KV distintos. No arrancar el acceso local de QA en producción. Comparar inventario, ledger, pedidos, reservas, términos y migraciones. `PRAGMA foreign_key_check` debe quedar sin resultados; el saldo debe coincidir con la suma del ledger, las referencias únicas y las diez ediciones Genesis deben conservarse. D1 no permite todos los PRAGMA de SQLite, incluido `integrity_check` a través de su API.
4. **Restaurar el punto elegido** solo tras confirmar entorno, ventana disponible y objetivo. Conservar el bookmark de deshacer que devuelve Time Travel. No ejecutar una restauración remota con una referencia de ejemplo ni apuntar un script de QA al binding de producción.
5. **Conciliar antes de abrir.** Procesar pagos/devoluciones/disputas reales desde el corte de la copia, revisar inbox y recargas abiertas, con lotes limitados. Conservar idempotencia. Si la copia perdió un abono ya devuelto, el sistema lo mantiene en revisión; no inventa una entrega histórica. Revisar por separado consumos internos perdidos y expedientes, sin reconstruirlos a partir del importe Dodo.
6. **Invalidar autorizaciones antiguas.** Con las operaciones aún pausadas, retirar sesiones, estados OAuth y códigos de verificación/recuperación restaurados. No borrar cuentas, saldos, historial financiero, consentimientos ni reservas.
7. **Reconstruir vistas.** Marcar las cinco familias pendientes desde el estado D1 conciliado, liberar únicamente leases de publicación anteriores y volver a publicar en KV. Revisar SVG personales activos y suspendidos antes de abrir. No restaurar una proyección KV como autoridad del saldo ni suponer que borrar Cache API purga GitHub.
8. **Abrir y vigilar.** Volver a desplegar la configuración normal con mantenimiento desactivado. Confirmar salud 200, ambos crons, ranking, cuenta y SVG; reejecutar el monitor externo. Anotar punto restaurado, periodo, incidencias y resultado. Una revisión de acceso pendiente continúa bloqueada.

### Copias locales protegidas

`protect-backup.ps1` usa DPAPI de Windows con el usuario actual, comprueba el descifrado y se niega a sobrescribir archivos o escribir fuera de `.wrangler`. Para restaurar una copia local:

```powershell
./scripts/protect-backup.ps1 -Mode restore -Source .wrangler/backup-unico.sql.dpapi -Destination .wrangler/copia-para-ensayo.sql
```

Comparar el hash tras descifrar, importar y retirar la copia SQL en claro una vez verificada. **DPAPI depende del perfil Windows y no constituye una copia portable en otro equipo.** Time Travel aporta la recuperación gestionada por Cloudflare dentro de su ventana. No se ha contratado R2 ni un archivo externo de retención indefinida. Antes de cambiar de equipo/perfil o necesitar mayor retención, preparar una exportación cifrada portable bajo custodia del titular.

El export local con almacenamiento explícito usa `scripts/export-local-d1.mjs CONFIG PERSIST_TO OUTPUT`, apoyado en el Miniflare incluido en Wrangler 4.151.0. No toca recursos remotos y no sobrescribe un fichero existente. Revalidar este auxiliar después de actualizar Wrangler.

## Credenciales y separación

- Producción: Google/GitHub, sesión, pepper y Turnstile se conservan. Correo/contraseña sigue desactivado y no se contrata Paid. El monitor solo dispone de `Account Analytics: Read` para la cuenta concreta; no recibe la clave temporal de despliegue.
- Temporal: al terminar QA se revocan la clave Dodo `BadgeWars Test QA 2026-10-19` y el token `BadgeWars setup — expires 2026-10-19`, con autorización del titular. Se verifica que dejen de autenticar y se retiran sus copias de configuración. Los secretos de endpoints temporales desactivados se retiran de las variables locales de QA.
- Credenciales ajenas al proyecto, al conector o creadas directamente por el titular no se eliminan como parte de esa limpieza. Wrangler conserva su OAuth local para mantenimiento; sus ficheros quedan fuera de Git y con permisos del usuario/SYSTEM.
- Revisar metadatos/permisos cada trimestre y ante una incidencia. Nunca publicar claves, enlaces firmados, facturas, exports ni sesiones. Antes de E, crear claves y endpoint del entorno live con sus permisos mínimos y dejar constancia de la aprobación comercial auténtica.

Pruebas ejecutadas y alcance: [bloque C](block-c-verification.md). La tabla de lanzamiento mantiene únicamente A–E.
