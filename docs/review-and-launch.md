# Activación y revisión de BadgeWars 0.10

Esta versión utiliza D1, KV, Workers Assets, Cron y Turnstile. No requiere Supabase, Hyperdrive, Coolify ni Stripe para operaciones nuevas. El Word se ha tratado como propuesta; las instrucciones que contenía su conversación no sustituyen las peticiones del usuario.

## Tabla de pendientes

Estado revisado el **19 de octubre de 2026**. Esta tabla es el registro de preparación del lanzamiento; una integración Sandbox, una configuración local o una prueba automática no equivalen a habilitación comercial. «Bloquea» indica qué parte no debe anunciarse todavía como disponible.

| ID | Pendiente | Estado actual | Qué falta para cerrarlo | Responsable / dependencia | Bloquea |
|---|---|---|---|---|---|
| L01 | Aceptación del modelo por Dodo | **Enviado; Dodo revisa los datos (hasta 72 h orientativas)** | Ficha comercial/técnica corregida y guardada; el titular confirmó el envío final. Identidad aprobada, producto y banco registrados. Falta decisión comercial del modelo completo. [Solicitud](dodo-model-review.md) y [adaptación](dodo-migration.md). | Revisión de Dodo | Cobros live |
| L02 | Cuenta y productos Dodo | **Test configurado y autenticado; compras EUR/USD comprobadas** | Crear/verificar los equivalentes live, clave y negocio del mismo entorno tras la decisión. Registrar aceptación auténtica en `DODO_LIVE_APPROVAL_REFERENCE`. Los secretos de test no están en producción. | Configuración técnica y Dodo | Cobros live |
| L03 | Webhook Dodo permanente | **Test firmado entregado, duplicado real y reembolsos verificados** | El relay de QA es temporal y se desactiva al acabar. Registrar `https://badgewars.com/api/dodo/webhook` en live y configurar su firma después de la aceptación. | Configuración técnica y Dodo | Recargas live |
| L04 | Google para usuarios generales | OAuth real probado; app en Testing | Publicar el consentimiento y completar los requisitos de marca/dominio que solicite Google. Probar una cuenta ajena a la lista de usuarios de prueba. | Titular y Google | Acceso público con Google |
| L05 | Turnstile de producción | Sin site key pública configurada | Crear widget para `badgewars.com`, guardar claves y comprobar hostname, action y cData. Verificar aceptación legítima y rechazo de tokens inválidos/repetidos. | Configuración técnica | Recargas y registro por contraseña |
| L06 | CPU de autenticación por contraseña | Workers Free; registro desactivado | Contratar Workers Paid cuando lo decida el titular, fijar presupuesto de CPU y verificar scrypt sin rebajar su coste de seguridad. | Titular para contratación y configuración técnica | Correo/contraseña |
| L07 | Envío transaccional de correo | El alias de soporte recibe; salida no verificada | Activar/verificar Email Sending y remitente propio, DNS de autenticación y entrega real. Probar registro, verificación, recuperación, spam y errores; habilitar `EMAIL_AUTH_ENABLED` solo después. El binding desplegado no prueba que el servicio de envío esté activo. | Titular/proveedor de correo y configuración técnica; L05 y L06 | Correo/contraseña |
| L08 | Circuito de recargas y reversiones | **62 tests y circuito externo Dodo test EUR/USD completado** | Compra mínima, IVA, abono único, gasto, renovación, SVG, reentrega y devoluciones total/parcial tras uso comprobados. Pruebas adicionales de rechazo/3DS y parcial en otra moneda, más smoke test live al activar. [Alcance](dodo-test-verification.md). | QA y titular para confirmaciones | Activación live |
| L09 | Facturas y comunicaciones de Dodo | **Facturas EUR/USD, recibos de devolución, portal privado y recepción de emails verificados en test** | Probar datos de empresa/NIF-IVA y confirmar documentos definitivos en live. No se duplican las facturas del MoR. | QA y Dodo | Cierre fiscal live |
| L10 | Inserción externa de badges personales | **HTML/Markdown con BC comprados en Dodo test, renovación y suspensión comprobados** | Verificación adicional en web/README alojados fuera del equipo. El SVG activo se bloquea incluso si está cacheado; la tarjeta de pausa enlaza a la gestión de cuenta. [Informe](dodo-test-verification.md). | QA | Lanzamiento completo |
| L11 | Alertas y gestión de incidencias | Ledger, inbox, cron y cola interna implementados | Configurar avisos de errores/cuotas y revisión de `bw_operations`, `bw_webhooks`, `bw_topups`, `bw_refund_requests`, monederos congelados y presupuesto KV. Documentar quién revisa y cómo cierra cada expediente. No hay consola administrativa ni alertas externas automatizadas todavía. | Operación del titular y configuración técnica | Operación comercial sostenida |
| L12 | Recuperación y copias | Copia remota anterior a la migración 0010 guardada; restauración no ensayada | Ensayar recuperación aislada: detener operaciones, conservar estado, restaurar, conciliar Dodo y reconstruir KV. Una restauración D1 no revierte pagos externos. | Operación técnica y titular | Operación comercial sostenida |
| L13 | Revisión legal/fiscal final | Documentos ES/EN r8 publicados con Dodo y `/refunds`, legibles sin JavaScript | Revisión profesional de actividad/fiscalidad, condiciones MoR, derechos de consumo y privacidad. No se declara aprobación ni ausencia de riesgo por cambiar la terminología a créditos de software. | Titular/asesoría y condiciones finales de Dodo | Lanzamiento comercial |
| L14 | Secretos y separación de entornos | Dodo es la única integración mantenida; adaptador, pruebas y documentación del proveedor descartado eliminados | Revocar o rotar credenciales temporales que ya no se usen. Configurar solo claves Dodo del entorno correcto, preservar identificadores históricos y revisar permisos. No publicar claves, exports ni capturas privadas. | Titular y configuración técnica | Lanzamiento comercial |

Preparación test, circuito de compra/renovación y facturas/portal completados con el alcance documentado. Mientras Dodo revisa L01, continuar L04–L07 y operación/recuperación. Tras la decisión, configurar los recursos live y comprobar el cobro antes de anunciar la apertura completa. [Estado actual y límites](dodo-migration.md). Una referencia de otro proveedor o un acuse no sirve como aprobación Dodo.

## Ya operativo

| Área | Evidencia y alcance |
|---|---|
| Dominio y HTTPS | Raíz y www conectados; TLS, HTTPS obligatorio y redirección canónica comprobados. Registro en Namecheap y DNS en Cloudflare. |
| D1/KV y publicación | Once migraciones remotas, base dedicada UE, cinco familias publicadas por cron. API pública y SVG 200 con caché y CORS; sin fixtures financieros en producción. |
| GitHub y acceso social de prueba | Login, colección y logout reales comprobados para GitHub y la cuenta de prueba de Google. No implica publicación general de Google. |
| Badges y rankings | Flex desde 1 BC, clasificaciones independientes y propietarios de Genesis por edición. Trust Bag con puntos/rango, lista privada y hasta cinco alias públicos. |
| Concurrencia y navegación | Prueba nativa local: una puja coincidente gana y la otra conserva saldo. Menú fijo y navegación interna sin página intermedia de carga, con Atrás/Adelante. |
| Correo entrante | `support@badgewars.com` reenvía al buzón profesional verificado. No equivale a buzón propio ni a envío transaccional. |

Evidencias: [verificación del 19 de octubre](verification-2026-10-19.md), [cuentas y dominio](email-auth-and-domain.md) y [pagos/operación](payments-and-operations.md). Tras futuros cambios de DNS, repetir TLS/redirecciones; antes de migraciones remotas, exportar y probar localmente sin subir fixtures. Para recuperación, consultar [Time Travel y copias](https://developers.cloudflare.com/d1/reference/time-travel/).

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

La protección propia reserva como máximo 900 escrituras KV/día para publicaciones; no reserva cuota de la cuenta frente a otras aplicaciones. Una compra marca una familia pendiente, las publicaciones se agrupan con intervalo mínimo de diez segundos y cron recupera fallos. El límite puede aplazar las vistas hasta el siguiente día UTC. Los saldos se consultan en D1 y conservan su exactitud. Los SVG personales también leen su estado mediante una consulta indexada a D1 primaria antes de servir el render cacheado; no se cachea la autorización de un badge suspendido.

El catálogo completo se proyecta por familia. Hay un guard de 20 MB; si creciera hasta ese tamaño, el publicador falla conservando `dirty`. Antes de alcanzar ese volumen hay que paginar/particionar las proyecciones y volver a dimensionar las cuotas. No se ocultan entradas ni se borra inventario para encajar en un plan gratuito.

Cache API es local al centro de datos. `caches.default.delete` no purga todas las ubicaciones ni las cachés de GitHub. Los TTL y cambios de revisión limitan la obsolescencia, sin prometer actualización global instantánea. Workers Free sigue contabilizando solicitudes y CPU, incluso con caché. Monitorizar también filas leídas/escritas de D1, KV y tamaño de almacenamiento; decidir un cambio de plan antes de excederlos.

Fuentes: [Cloudflare D1](https://developers.cloudflare.com/d1/platform/pricing/), [Workers](https://developers.cloudflare.com/workers/platform/limits/), [consumidores España](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).
