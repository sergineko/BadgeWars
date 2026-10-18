# Activación y revisión de BadgeWars 0.8

Esta versión utiliza D1, KV, Workers Assets, Cron y Turnstile. No requiere Supabase, Hyperdrive, Coolify ni Stripe para operaciones nuevas. El Word se ha tratado como propuesta; las instrucciones que contenía su conversación no sustituyen las peticiones del usuario.

## Pendiente de configurar

1. Verificar propagación y certificado de `badgewars.com`, conectar el Worker y resolver el parking inicial. Nameservers guardados, D1 UE y KV exclusivos ya creados; IDs incorporados en `wrangler.jsonc`. Ver [estado de dominio y cuentas](email-auth-and-domain.md).
2. Aplicar `migrations/0001` a `0008` en el destino vacío, tras copia/exportación si hubiera datos. Primero local; remoto solo durante el despliegue autorizado. Se han creado recursos vacíos; todavía no hay migraciones remotas.
3. GitHub OAuth y su secreto local ya creados; proyecto Google `badgewars` creado. Completar cuenta profesional de Google, consentimiento y cliente web; cargar secretos en Worker y probar ambos callbacks. Usar `AUTH_COOKIE_SECRET` aleatorio de al menos 32 caracteres.
4. Crear Turnstile con el hostname público y configurar `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`. El servidor exige hostname, action y cData de la cuenta correctos; no basta un token del navegador.
5. La organización/producto de **Sandbox** ya están creados y conectados localmente; el token de QA caduca tras un día. Para pruebas posteriores renovarlo de forma controlada; para producción usar recursos y credenciales distintos. El slug del portal está configurado. Mantener permisos mínimos de checkout/órdenes y una clave Standard Webhooks nueva; no usar el formato heredado de Polar.
6. Configurar el endpoint permanente `https://badgewars.com/api/polar/webhook`, API version `2026-10`, y eventos `order.paid`, `order.updated`, `order.refunded`, `refund.created`, `refund.updated`. Los eventos de una compra real de Sandbox ya se han recibido mediante un relay temporal; ese relay no sustituye el endpoint de producción. `order.created` no acredita saldo.
7. Verificar datos legales de SergioTech, documentos ES/EN, procedimientos de reclamación/desistimiento, contratos de tratamiento y transferencias internacionales con proveedores. El domicilio y NIF suministrados están incorporados; no hay teléfono publicado.
8. Obtener aceptación escrita de Polar del modelo real (saldo no transferible, rankings pagados, contribuciones, exclusividad de Genesis). Sin esa aceptación, conservar sandbox o elegir un proveedor que lo admita. Introducir una referencia verificable a la aprobación en `POLAR_LIVE_APPROVAL_REFERENCE` solamente después de obtenerla. No se ha contactado con el proveedor.
9. Cambiar producto/token/clave y entorno a producción únicamente con aprobación comercial y pruebas completas. El MoR no elimina las obligaciones fiscales, de actividad o de consumo propias del titular.
10. Comprobar cron cada cinco minutos y hacer la primera publicación de las cinco familias. Inspeccionar `bw_operations`, `bw_webhooks`, `bw_topups`, `bw_badges` y `bw_kv_budget`; conservar alertas de proveedor y controlar cuotas de la cuenta Cloudflare.
11. Definir y ensayar la recuperación de datos: D1 Time Travel está siempre activo y conserva siete días en Workers Free. Para retención adicional, preparar exportaciones protegidas fuera de Git y con acceso restringido. Antes de restaurar, detener nuevas operaciones, conservar el estado actual y conciliar los pagos posteriores al punto restaurado con Polar; después reconstruir KV. Una restauración de D1 no deshace cobros del proveedor. No se ha ejecutado ninguna restauración remota. Referencia: [Time Travel y copias](https://developers.cloudflare.com/d1/reference/time-travel/).

`pnpm readiness` enumera configuración local sin revelar valores. Los secretos guardados solo en Cloudflare deben comprobarse allí. Un resultado OK local no confirma aprobaciones, funcionamiento externo ni aplicación de migraciones remotas.

## Comprobaciones necesarias en sandbox

- Login/logout con ambos proveedores y callback inválido/repetido; cuenta y colección separadas por proveedor.
- Recargas de 5, 15 y cantidad libre, en USD/EUR, con impuestos. Las tres casillas se aceptan por separado; la versión exacta queda conservada. Descarga privada de confirmación.
- Vuelta de checkout sin pago, doble webhook y evento fuera de orden, indisponibilidad del proveedor y webhook perdido recuperado por cron.
- Dos usuarios intentan el mismo nivel: solo uno lo adquiere, el otro conserva su saldo. Retomar 100→102 después del líder 101 consume 2 BC. Idempotencia sin duplicación.
- Genesis: diez números únicos y permanentes; la cuenta no adquiere un segundo. Ningún saldo se descuenta al agotarse.
- Trust Bag: sin autoapoyo, puntos exactos, listado completo privado y máximo cinco alias públicos; el apoyo pagado no se presenta como certificación profesional.
- Reembolso parcial y total, incluidos créditos ya consumidos: sin saldo negativo, sin segunda reversión y con expediente de revisión. Revisar bolsas receptoras de apoyos financiados por el monedero afectado.
- Fallo o agotamiento KV: operación financiera conservada, `dirty=1`, publicación posterior. El retraso público se explica; no confundirlo con una compra perdida.
- Firma falsa/repetida/caducada, peticiones sin sesión/origen legítimo, consulta de badges o justificantes de otra cuenta.

## Capacidad y operación

La protección propia reserva como máximo 900 escrituras KV/día para publicaciones; no reserva cuota de la cuenta frente a otras aplicaciones. Una compra marca una familia pendiente, las publicaciones se agrupan con intervalo mínimo de diez segundos y cron recupera fallos. El límite puede aplazar las vistas hasta el siguiente día UTC. Los saldos se consultan en D1 y conservan su exactitud.

El catálogo completo se proyecta por familia. Hay un guard de 20 MB; si creciera hasta ese tamaño, el publicador falla conservando `dirty`. Antes de alcanzar ese volumen hay que paginar/particionar las proyecciones y volver a dimensionar las cuotas. No se ocultan entradas ni se borra inventario para encajar en un plan gratuito.

Cache API es local al centro de datos. `caches.default.delete` no purga todas las ubicaciones ni las cachés de GitHub. Los TTL y cambios de revisión limitan la obsolescencia, sin prometer actualización global instantánea. Workers Free sigue contabilizando solicitudes y CPU, incluso con caché. Monitorizar también filas leídas/escritas de D1, KV y tamaño de almacenamiento; decidir un cambio de plan antes de excederlos.

Fuentes: [Cloudflare D1](https://developers.cloudflare.com/d1/platform/pricing/), [Workers](https://developers.cloudflare.com/workers/platform/limits/), [Polar AUP](https://polar.sh/legal/acceptable-use-policy), [consumidores España](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).
## Verificación local de esta revisión

- 41 pruebas automáticas correctas y comprobaciones de sintaxis.
- Compilación `wrangler deploy --dry-run` correcta, sin despliegue.
- Seis migraciones aplicadas en D1 local; comprobaciones en workerd con D1/KV nativos de gasto atómico, reintento, inventario, inserción propietaria, cron, SVG y respuesta 304. Evidencia: `artifacts/d1-native-smoke.json`.
- Conservación comprobada de condiciones aceptadas r2 al introducir r3; no se reescribe el documento previo.
- Revisión en navegador de ES/EN, rutas limpias, páginas legales, recargas de ejemplo, casillas sin premarcar y pantalla estrecha sin desbordamiento. Captura: `artifacts/refund-policy-v7.png`.
- Compra simulada real en Polar Sandbox y factura PDF revisadas; cuatro webhooks completos producen un único abono de 5 BC. No se han cobrado fondos reales ni desplegado recursos remotos. Recepción de emails pendiente de confirmación del titular.
- Devolución total de ese pedido simulado autorizada y completada; conciliación manual contra Polar con una sola reversión, saldo 0 y sin deuda. Pendientes el webhook real de reembolso, devoluciones parciales/tras consumo y justificante rectificativo. Endpoint temporal desactivado y túneles detenidos.
- 40 variantes de SVG personal cargadas en otro origen local, con HTML/Markdown; acceso propietario y actualización de rango en la misma URL verificados. Detalle y límites en [verification-2026-10-18.md](verification-2026-10-18.md).

## Incorporación de cuentas y revisión de recargas (0.8)

Workers Free se conserva por petición del titular durante la preparación. Antes de activar correo/contraseña: Paid, presupuesto de CPU para scrypt, Email Sending/DNS verificado, secretos independientes y entrega real. El registro está desactivado por defecto en producción; no bajar el coste del hash para encajarlo en Free. Ver [email-auth-and-domain.md](email-auth-and-domain.md).

La API privada `/api/me/refund-request` solo registra una revisión por no entrega; valida la orden real de Polar y reserva el monedero mediante triggers. Se rechaza si ya hubo abono, consumo posterior al inicio de la recarga o deuda; reponer saldo no recupera elegibilidad. Durante la revisión se impiden nuevos gastos y un abono que compita con la devolución. No se devuelve dinero automáticamente ni se bloquean las facultades legales del MoR. Ver el procedimiento operativo de cierre.

Revisión 0.8: 53 pruebas, ocho migraciones locales, scrypt y flujo de verificación/recuperación con D1/workerd y email simulado comprobados. No equivale a entrega de emails en producción ni a OAuth social real. `pnpm readiness --production` comprueba el fichero local de preparación de producción sin imprimir secretos; no valida permisos, DNS ni un plan contratado.
