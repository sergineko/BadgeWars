# Activación y revisión de BadgeWars 0.11

Esta versión utiliza D1, KV, Workers Assets, Cron y Turnstile. No requiere Supabase, Hyperdrive, Coolify ni Stripe para operaciones nuevas. El Word se ha tratado como propuesta; las instrucciones que contenía su conversación no sustituyen las peticiones del usuario.

## Plan de lanzamiento: cinco bloques

Estado revisado el **20 de octubre de 2026**. El trabajo pendiente se agrupa en estos **cinco bloques estables**. Las pruebas, configuraciones y dependencias de cada bloque son su detalle de cierre, no nuevos puntos de la lista. Los identificadores L01–L14 se conservan debajo para mantener las referencias anteriores.

| Bloque | Trabajo que incluye | Cuándo se puede cerrar |
|---|---|---|
| **A · Accesos de usuarios** | **Google público y GitHub operativos y probados.** Correo/contraseña implementado y probado con D1; permanece desactivado hasta Paid. | Preparado hasta la dependencia de Paid. Cloudflare bloquea el alta de Email Sending desde Free: al contratar habrá que verificar el remitente/DNS, entrega y CPU antes de activar el formulario. No es solo una cuota de visitas. [Estado](email-auth-and-domain.md). |
| **B · Pruebas finales** | **Cerrado en test:** rechazos sin BC, checkout con `force_3ds`, factura de empresa, parcial EUR y SVG personal en web HTTPS/README de GitHub. 69 tests correctos. [Resultados y límites](block-b-verification.md). | La prueba bancaria interactiva, el cobro y los documentos reales se verifican con E; el simulador no presentó un reto 3DS. |
| **C · Operación y seguridad** | **Cerrado:** avisos operativos y cuotas, monitor externo, gestión auditable de incidencias, restauración aislada y retirada de las dos credenciales temporales autorizadas. [Resultados y alcance](block-c-verification.md) · [Procedimiento](operations-runbook.md). | Preparación operativa completada en Free. Las credenciales y comprobaciones live pertenecen a E. |
| **D · Cierre legal y fiscal** | **Web r10 publicada; expediente fiscal y registro de tratamientos preparados; consulta censal real efectuada con el titular.** Contrato público Dodo contrastado. Soporte por email y vía postal, sin teléfono. [Revisión y expediente](block-d-legal-review.md). | Quedan **las actuaciones fiscales del titular y la validación de contratos, privacidad y atención exclusivamente escrita**. La conclusión censal se comunicó en privado; no se han presentado declaraciones. Preparado documentalmente, pendiente de trámites y validación reales. |
| **E · Activación de cobros con Dodo** | Recibir aprobación del modelo, configurar productos EUR/USD y claves live, conectar el webhook permanente y comprobar un cobro real con su abono, factura y portal. Recarga mínima: 5 BC más impuestos. | Depende de la revisión de Dodo. Su aprobación no activa automáticamente los cobros. |

**Actualización de badges:** Build Funded personal y fijo a 50 BC, sin límite de unidades; Apex Flex con cierre e historial independientes preparados. Se publica una sola clasificación abierta y sin etiquetas de temporada hasta que exista otra. [Reglas, pruebas y operación](badge-seasons.md).

**Ya cerrado:** dominio/HTTPS, infraestructura D1/KV/Workers, circuito principal de pagos en test, facturas/emails/portal en test y Turnstile de producción. Los badges, rankings y navegación están implementados; B incluye también la inserción comprobada en una web HTTPS y GitHub.

Orden de trabajo: B está completado en test y C está preparado y comprobado. La adaptación documental de D ya está publicada; queda la validación del titular/asesoría indicada en su fila. E se cierra tras la aprobación y configuración live. A ya ofrece acceso público social; el acceso por contraseña puede quedar para una segunda fase manteniendo Workers Free. La aprobación de Dodo, por sí sola, no sustituye el cierre legal/fiscal ni la configuración live.

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
| L08 | Circuito de recargas y reversiones | **Circuito Dodo test EUR/USD y ampliación B completados; 69 tests superados** | Rechazos sin abono, `force_3ds` sin reto interactivo del simulador y parcial EUR comprobados, además del circuito inicial. Falta comprobación live al activar E. [Resultados](block-b-verification.md). | QA y titular para confirmaciones | Activación live |
| L09 | Facturas y comunicaciones de Dodo | **Facturas B2C EUR/USD y B2B con NIF ficticio, recibos, portal y emails verificados en test** | Confirmar documentos definitivos y datos fiscales reales en E. La simulación no valida VIES ni determina la fiscalidad del titular. No se duplican facturas del MoR. | QA y Dodo | Cierre fiscal live |
| L10 | Inserción externa de badges personales | **HTML/Markdown personal verificado en una web HTTPS y README de GitHub** | Cerrado en test. Renovación y suspensión también verificadas; [evidencia externa archivada](qa-embed-readme.md). | Cerrado; comprobación live con E | Ningún pendiente adicional de QA externa |
| L11 | Alertas y gestión de incidencias | **Configurado y probado** | Correo agregado al destino verificado, Analytics de solo lectura con umbrales 80/95 %, salud pública y monitor externo horario. CLI privada con revisión inmutable; cerrar un expediente no desbloquea saldo ni badges. [Procedimiento y responsable](operations-runbook.md). | Cerrado; vigilancia continua del titular | Sin pendiente de preparación |
| L12 | Recuperación y copias | **Restauración aislada ensayada** | Export/import nativo, mantenimiento, conciliación real de Dodo test, idempotencia, reconstrucción KV y SVG activo/suspendido comprobados. Copia de producción protegida con DPAPI; Time Travel de siete días en Free. [Alcance y límites](block-c-verification.md). | Cerrado; realizar copias antes de intervenciones | Sin pendiente de preparación |
| L13 | Revisión legal/fiscal final | **Web r10, expediente y registro de tratamientos preparados; censo consultado en la AEAT el 20/10/2026** | 86 tests correctos. Resultado censal entregado privadamente; no se publicó ni se modificaron datos. Quedan los trámites fiscales y el cierre jurídico del titular, incluidos contratos y canales escritos. No se incorporará teléfono por decisión del titular. [Detalle D](block-d-legal-review.md). | Titular/asesoría y condiciones finales de Dodo | Lanzamiento comercial |
| L14 | Secretos y separación de entornos | **Dos credenciales temporales revocadas; rechazo de autenticación verificado** | Clave Dodo QA y token Cloudflare de configuración retirados. Webhook temporal desactivado. Monitor con Analytics de solo lectura, sin acceso a tablas. Producción conserva únicamente las credenciales funcionales necesarias. Las nuevas claves live se revisan con E. | Cerrado para C; configuración live en E | Solo depende de E para cobros live |

Preparación test, circuito de compra/renovación y facturas/portal completados con el alcance documentado. Turnstile de producción (L05) también configurado y verificado. [Estado actual y límites](dodo-migration.md). Una referencia de otro proveedor o un acuse no sirve como aprobación Dodo.

</details>

## Ya operativo

| Área | Evidencia y alcance |
|---|---|
| Dominio y HTTPS | Raíz y www conectados; TLS, HTTPS obligatorio y redirección canónica comprobados. Registro en Namecheap y DNS en Cloudflare. |
| D1/KV y publicación | Catorce migraciones remotas, base dedicada UE, cinco familias publicadas por cron. API pública y SVG 200 con caché y CORS; sin fixtures financieros en producción. |
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
