# Activación y revisión de BadgeWars 0.10

Esta versión utiliza D1, KV, Workers Assets, Cron y Turnstile. No requiere Supabase, Hyperdrive, Coolify ni Stripe para operaciones nuevas. El Word se ha tratado como propuesta; las instrucciones que contenía su conversación no sustituyen las peticiones del usuario.

## Plan de lanzamiento: cinco bloques

Estado revisado el **19 de octubre de 2026**. El trabajo pendiente se agrupa en estos **cinco bloques estables**. Las pruebas, configuraciones y dependencias de cada bloque son su detalle de cierre, no nuevos puntos de la lista. Los identificadores L01–L14 se conservan debajo para mantener las referencias anteriores.

| Bloque | Trabajo que incluye | Cuándo se puede cerrar |
|---|---|---|
| **A · Accesos de usuarios** | **Google público y GitHub operativos y probados.** Correo/contraseña implementado y probado con D1; permanece desactivado hasta Paid. | Preparado hasta la dependencia de Paid. Cloudflare bloquea el alta de Email Sending desde Free: al contratar habrá que verificar el remitente/DNS, entrega y CPU antes de activar el formulario. No es solo una cuota de visitas. [Estado](email-auth-and-domain.md). |
| **B · Pruebas finales** | Completar rechazo/3DS, devolución parcial en otra moneda, datos fiscales de empresa e inserción de badges en una web/README externos. El circuito principal, facturas y portal ya están verificados en test. **HTML con alternativa local ante fallos de conexión implementado y probado**, sin usar un ranking antiguo. [Alcance](badge-connection-fallback.md). | Se puede avanzar ahora en test y alojamiento externo. La comprobación real de cobro y documentos se cierra con E. |
| **C · Operación y seguridad** | Alertas de errores/cuotas, procedimiento de incidencias, ensayo de restauración y revisión/retirada de credenciales temporales. | Se puede preparar ahora. La revisión de las credenciales live se termina con E. |
| **D · Cierre legal y fiscal** | Revisión profesional de los documentos ES/EN publicados, actividad, privacidad, fiscalidad y condiciones definitivas del MoR. | El titular/asesoría puede avanzar ahora; cerrar conforme a las condiciones finalmente aceptadas por Dodo. |
| **E · Activación de cobros con Dodo** | Recibir aprobación del modelo, configurar productos EUR/USD y claves live, conectar el webhook permanente y comprobar un cobro real con su abono, factura y portal. Recarga mínima: 5 BC más impuestos. | Depende de la revisión de Dodo. Su aprobación no activa automáticamente los cobros. |

**Ya cerrado:** dominio/HTTPS, infraestructura D1/KV/Workers, circuito principal de pagos en test, facturas/emails/portal en test y Turnstile de producción. Los badges, rankings y navegación están implementados; B recoge la comprobación adicional de inserción en alojamiento externo.

Orden de trabajo: avanzar B y C mientras Dodo revisa; tramitar D con el titular/asesoría; cerrar E tras la aprobación. A ya ofrece acceso público social; el acceso por contraseña puede quedar para una segunda fase manteniendo Workers Free. No es necesario volver a contar Turnstile como pendiente.

<details>
<summary>Detalle técnico y trazabilidad de los cinco bloques</summary>

Mapa: A = L04/L06/L07; B = L08/L09/L10; C = L11/L12/L14; D = L13; E = L01/L02/L03 y comprobaciones live de B/C. L05 está cerrado. Cada punto pertenece a un bloque principal aunque tenga una dependencia de E.

Una integración test, una configuración local o una prueba automática no equivalen a habilitación comercial. «Bloquea» indica qué parte no debe anunciarse todavía como disponible.

| ID | Pendiente | Estado actual | Qué falta para cerrarlo | Responsable / dependencia | Bloquea |
|---|---|---|---|---|---|
| L01 | Aceptación del modelo por Dodo | **Enviado; Dodo revisa los datos (hasta 72 h orientativas)** | Ficha comercial/técnica corregida y guardada; el titular confirmó el envío final. Identidad aprobada, producto y banco registrados. Falta decisión comercial del modelo completo. [Solicitud](dodo-model-review.md) y [adaptación](dodo-migration.md). | Revisión de Dodo | Cobros live |
| L02 | Cuenta y productos Dodo | **Test configurado y autenticado; compras EUR/USD comprobadas** | Crear/verificar los equivalentes live, clave y negocio del mismo entorno tras la decisión. Registrar aceptación auténtica en `DODO_LIVE_APPROVAL_REFERENCE`. Los secretos de test no están en producción. | Configuración técnica y Dodo | Cobros live |
| L03 | Webhook Dodo permanente | **Test firmado entregado, duplicado real y reembolsos verificados** | El relay de QA es temporal y se desactiva al acabar. Registrar `https://badgewars.com/api/dodo/webhook` en live y configurar su firma después de la aceptación. | Configuración técnica y Dodo | Recargas live |
| L04 | Google para usuarios generales | **En producción; cuenta fuera de la antigua lista de prueba y logout comprobados** | Cerrado para acceso público básico `openid profile`. Marca/contacto/dominio revisados; sin permisos sensibles ni restringidos. GitHub también probado de nuevo. | Cerrado | Ningún bloqueo de acceso social |
| L05 | Turnstile de producción | **Configurado y comprobado en el dominio real** | Widget gestionado exclusivo de `badgewars.com`, secreto en Workers y copia local ignorada. Token real aceptado; repetido e inválido rechazados. Dominio, action y cData comprobados; fallos del verificador rechazan la operación. [Evidencia y alcance](turnstile-verification.md). Repetir la prueba funcional al activar recargas y correo, cuyas dependencias siguen pendientes. | Cerrado para la configuración antibots | Ningún bloqueo adicional de Turnstile |
| L06 | CPU de autenticación por contraseña | Workers Free; registro desactivado | Contratar Workers Paid cuando lo decida el titular, fijar presupuesto de CPU y verificar scrypt sin rebajar su coste de seguridad. | Titular para contratación y configuración técnica | Correo/contraseña |
| L07 | Envío transaccional de correo | **Preparado en código; alta bloqueada por Workers Free en el panel de Cloudflare** | Tras Paid, activar/verificar Email Sending y remitente propio, DNS de autenticación y entrega real. Probar registro, verificación, recuperación, spam y errores; habilitar `EMAIL_AUTH_ENABLED` solo después. El binding desplegado no prueba que el servicio de envío esté activo. [Secuencia preparada](email-auth-and-domain.md#activación-tras-contratar-paid). | Dependencia de Paid del bloque A; configuración técnica | Correo/contraseña |
| L08 | Circuito de recargas y reversiones | **Circuito externo Dodo test EUR/USD completado; proyecto con 66 tests superados** | Compra mínima, IVA, abono único, gasto, renovación, SVG, reentrega y devoluciones total/parcial tras uso comprobados. Pruebas adicionales de rechazo/3DS y parcial en otra moneda, más smoke test live al activar. [Alcance](dodo-test-verification.md). | QA y titular para confirmaciones | Activación live |
| L09 | Facturas y comunicaciones de Dodo | **Facturas EUR/USD, recibos de devolución, portal privado y recepción de emails verificados en test** | Probar datos de empresa/NIF-IVA y confirmar documentos definitivos en live. No se duplican las facturas del MoR. | QA y Dodo | Cierre fiscal live |
| L10 | Inserción externa de badges personales | **HTML/Markdown con BC comprados en Dodo test, renovación y suspensión comprobados** | Verificación adicional en web/README alojados fuera del equipo. El SVG activo se bloquea incluso si está cacheado; la tarjeta de pausa enlaza a la gestión de cuenta. [Informe](dodo-test-verification.md). | QA | Lanzamiento completo |
| L11 | Alertas y gestión de incidencias | Ledger, inbox, cron y cola interna implementados | Configurar avisos de errores/cuotas y revisión de `bw_operations`, `bw_webhooks`, `bw_topups`, `bw_refund_requests`, monederos congelados y presupuesto KV. Documentar quién revisa y cómo cierra cada expediente. No hay consola administrativa ni alertas externas automatizadas todavía. | Operación del titular y configuración técnica | Operación comercial sostenida |
| L12 | Recuperación y copias | Copia remota anterior a la migración 0010 guardada; restauración no ensayada | Ensayar recuperación aislada: detener operaciones, conservar estado, restaurar, conciliar Dodo y reconstruir KV. Una restauración D1 no revierte pagos externos. | Operación técnica y titular | Operación comercial sostenida |
| L13 | Revisión legal/fiscal final | Documentos ES/EN r8 publicados con Dodo y `/refunds`, legibles sin JavaScript | Revisión profesional de actividad/fiscalidad, condiciones MoR, derechos de consumo y privacidad. No se declara aprobación ni ausencia de riesgo por cambiar la terminología a créditos de software. | Titular/asesoría y condiciones finales de Dodo | Lanzamiento comercial |
| L14 | Secretos y separación de entornos | Dodo es la única integración mantenida; adaptador, pruebas y documentación del proveedor descartado eliminados | Revocar o rotar credenciales temporales que ya no se usen. Configurar solo claves Dodo del entorno correcto, preservar identificadores históricos y revisar permisos. No publicar claves, exports ni capturas privadas. | Titular y configuración técnica | Lanzamiento comercial |

Preparación test, circuito de compra/renovación y facturas/portal completados con el alcance documentado. Turnstile de producción (L05) también configurado y verificado. [Estado actual y límites](dodo-migration.md). Una referencia de otro proveedor o un acuse no sirve como aprobación Dodo.

</details>

## Ya operativo

| Área | Evidencia y alcance |
|---|---|
| Dominio y HTTPS | Raíz y www conectados; TLS, HTTPS obligatorio y redirección canónica comprobados. Registro en Namecheap y DNS en Cloudflare. |
| D1/KV y publicación | Once migraciones remotas, base dedicada UE, cinco familias publicadas por cron. API pública y SVG 200 con caché y CORS; sin fixtures financieros en producción. |
| Acceso público con Google y GitHub | Google publicado en producción, probado con una cuenta ajena a la antigua lista de test; login, colección privada y logout comprobados. GitHub vuelto a comprobar. Correo/contraseña queda desactivado hasta Paid y verificación de salida. |
| Protección antibots | Turnstile gestionado para `badgewars.com`; verificación real del token en el Worker, rechazo de repetidos/inválidos y validación estricta de dominio, operación y cuenta. [Informe](turnstile-verification.md). |
| Badges y rankings | Flex desde 1 BC, clasificaciones independientes y propietarios de Genesis por edición. Trust Bag con puntos/rango, lista privada y hasta cinco alias públicos. |
| Concurrencia y navegación | Prueba nativa local: una puja coincidente gana y la otra conserva saldo. Menú fijo y navegación interna sin página intermedia de carga, con Atrás/Adelante. |
| Correo entrante | `support@badgewars.com` reenvía al buzón profesional verificado. No equivale a buzón propio ni a envío transaccional. |

Evidencias: [verificación del 19 de octubre](verification-2026-10-19.md), [cuentas y dominio](email-auth-and-domain.md) y [pagos/operación](payments-and-operations.md). Tras futuros cambios de DNS, repetir TLS/redirecciones; antes de migraciones remotas, exportar y probar localmente sin subir fixtures. Para recuperación, consultar [Time Travel y copias](https://developers.cloudflare.com/d1/reference/time-travel/).

`pnpm readiness` enumera configuración local sin revelar valores. Los secretos guardados solo en Cloudflare deben comprobarse allí. Un resultado OK local no confirma aprobaciones, funcionamiento externo ni aplicación de migraciones remotas.

## Guion de regresión de referencia

Estos casos documentan el alcance de comprobación, incluidos flujos ya probados. No constituyen una lista adicional de tareas pendientes: los casos que quedan por cerrar están recogidos en B y E y sus informes enlazados.

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
