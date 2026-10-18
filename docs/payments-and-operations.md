# Pagos, facturas y operación

## Qué se ha aplicado del Word

`Propuesta de cobros.docx` propone Polar como MoR, recargas en lugar de un checkout por puja, créditos enteros, sugerencias de 5/15/50 y renovación por diferencia. El usuario confirmó saldo único: 1 USD o 1 EUR de base = 1 BC. Se ha implementado sin rehacer el frontend en Astro: el proyecto real usa módulos ESM.

Se descartan sus afirmaciones de que un monedero evita automáticamente bloqueos, permite posponer obligaciones fiscales o elimina disputas. La AUP vigente de Polar restringe saldos de clientes, patrocinios/donaciones y prueba social pagada. Hace falta aceptación expresa del modelo real; no basta cambiar sus nombres. Sandbox permanece separado de producción. El 19 de octubre de 2026 se presentó la descripción completa en el onboarding de producción, que rechazó BC prepago, rankings pagados, Build Funded y Trust Bag con «Use case not supported». No hay aprobación ni cobros reales habilitados; ver [resultado y alcance](polar-model-review.md).

## Quién vende y quién factura

| Parte | Papel |
|---|---|
| SergioTech.es, titular identificado en `/legal` | Operador de BadgeWars, proveedor del uso, soporte funcional y responsable de sus propios tratamientos de datos. Sus datos no se sustituyen por los de Polar en el aviso legal. |
| Polar | Merchant of Record y revendedor autorizado de la compra. Cobra al comprador, gestiona impuestos de esa venta y expide factura/recibo. Prevalece la entidad identificada en el checkout y documento fiscal. |
| Comprador | Facilita en Polar email de compra y datos de facturación correctos; usa los enlaces de confirmación para acceder a sus documentos. |

Las condiciones de Polar prohíben que el proveedor emita otra factura al comprador o solicite un segundo pago por la misma transacción. BadgeWars solo ofrece justificantes operativos con créditos, referencia y condiciones; se etiquetan como documentos que **no son facturas fiscales**. El consumo posterior de saldo no provoca otra factura de BadgeWars por el mismo cobro. Los reembolsos monetarios se tramitan por Polar, no por transferencias directas del titular.

Polar envía sus confirmaciones transaccionales con enlace a su portal; allí el comprador descarga facturas y recibos y gestiona los datos admitidos por el proveedor. No prometemos que todo email lleve un PDF adjunto. El botón privado «Facturas y recibos · Polar» lleva al portal de la organización configurada en `POLAR_ORGANIZATION_SLUG`. Polar verifica el email usado en la compra; puede ser distinto del perfil social. No se almacenan enlaces autenticados permanentes ni PDFs en KV y no se desarrolla un emisor fiscal duplicado.

La factura PDF de una compra simulada en Polar Sandbox se ha descargado y revisado: identifica a BadgeWars via Polar Software, Inc. como emisor, con base, IVA y total separados. Antes del lanzamiento queda probar recepción real de emails, spam/reenvío por soporte, acceso del comprador al portal, datos de empresa/NIF-IVA y reembolsos/documentos rectificativos. No se ha verificado aún un envío de email real. Las obligaciones del proveedor con sus propios ingresos, facturación a Polar si procede, impuestos y actividad deben verificarse con su asesor; MoR se refiere a la venta al comprador, no a una exención general del titular.

Fuentes oficiales: [Buyer Terms](https://polar.sh/legal/checkout-buyer-terms), [Master Services Terms, apartado 10](https://polar.sh/legal/master-services-terms), [portal y emails](https://polar.sh/docs/features/customer-portal/navigate-customers), [facturas y recibos](https://polar.sh/docs/features/orders).

## Desistimiento y evidencias

Versión de condiciones `2026-10-18-r3`, íntegra en ES/EN. El punto 17 trata reclamaciones y ley; el punto 14 explica los requisitos y excepciones de los artículos 103.a) y 103.m) del TRLGCU. No se declara que el mero abono de un saldo sin consumir extinga automáticamente el desistimiento. La guía CPC sobre monedas virtuales distingue ese saldo del contenido adquirido con él; es una referencia relevante, sin afirmar que por sí sola resuelva la calificación de BadgeWars.

En la recarga se registran aceptación, solicitud de asignación inmediata y mayoría de edad, con texto/versiones inmutables por intento. En cada consumo se recogen separadamente la aceptación de reglas y la solicitud de ejecución inmediata/reconocimiento para los supuestos legalmente aplicables. D1 conserva esas declaraciones, fecha, idioma y una copia de condiciones por versión/idioma, sin actualizar documentos anteriores. El propietario puede descargar el justificante de esa operación.

La excepción de desistimiento exige también que corresponda materialmente al producto y se cumpla la confirmación contractual en soporte duradero. **Una casilla, un registro interno o un mero enlace no prueban por sí solos todos esos requisitos.** Antes de basar una denegación en esa excepción se debe validar la clasificación, la ejecución y la entrega documental del flujo concreto de Polar/BadgeWars. El sistema no rechaza automáticamente derechos obligatorios. No se presenta un justificante de BadgeWars como factura ni se promete una inmunidad frente a contracargos.

Fuentes: [TRLGCU, arts. 98 y 103](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555#a103), [CPC, principio 5, página 5](https://commission.europa.eu/document/download/8af13e88-6540-436c-b137-9853e7fe866a_en?filename=Key%20principles%20on%20in-game%20virtual%20currencies.pdf).

## Estados y recuperación

- Se guarda el intento antes de llamar a Polar. Reintentos idénticos devuelven el checkout ya conocido. Una respuesta incierta pasa a `review`: no se inventa una idempotencia del proveedor ni se crea otra sesión a ciegas.
- Checkout utiliza precio fijo por recarga, moneda, producto, organización y cliente vinculado en servidor. Sin descuentos ni cobros automáticos. La referencia de retorno solo consulta el estado; nunca acredita saldo.
- Firma Standard Webhooks con clave base64 decodificada y ventana de cinco minutos. Inbox D1 antes de responder 202; no conserva cuerpos con datos de facturación. Dos eventos por ejecución HTTP; cron recupera pendientes y sesiones conocidas.
- Solo una orden autoritativa pagada, del producto/organización/cliente/moneda/importe esperados, crea saldo una vez. `order.created` no basta. Orden y recarga tienen restricciones de unicidad; su ledger es inmutable.
- Débito, validación competitiva, inventario y puntos son atómicos en D1. Si cambia el precio o falta saldo, no se gasta nada. El número de Genesis nunca se vuelve a emitir.
- Devolución: se revierte el total acumulado de créditos enteros devueltos, una vez. Si falta saldo se registra la diferencia y se congela. Fracciones de crédito pasan a revisión sin redondear en perjuicio del comprador. También se revisan las bolsas receptoras del apoyo relacionado, preservando evidencias. La ficha suspendida sigue visible a su titular; se retira de proyecciones públicas y se bloquea nuevo código de inserción.
- No se ha asumido un webhook de disputas inexistente en la documentación consultada. Vigilar el panel/notificaciones de Polar y tratar las disputas manualmente. Polar puede devolver pagos por su propia política incluso si BadgeWars no ofrece devoluciones voluntarias.

## Revisión operativa

No actuar solo sobre el evento entrante. Consultar orden, cobro y reembolso actuales en Polar; contrastar la recarga, ledger y acciones. Resolver expedientes con trazabilidad; nunca borrar ledger/acciones o reutilizar referencias para «arreglar» saldos. Los ajustes de compensación y reactivaciones requieren una actuación administrativa documentada y no están expuestos como API pública.

Consultas de diagnóstico (sin escrituras):

```sql
SELECT id,kind,reference,created_at FROM bw_operations ORDER BY created_at DESC LIMIT 100;
SELECT id,type,resource_id,state,attempts FROM bw_webhooks WHERE state<>'complete';
SELECT id,state,credits,currency,errors FROM bw_topups WHERE state IN('creating','open','review');
SELECT user_id,balance,frozen,debt FROM bw_wallets WHERE frozen=1 OR debt>0;
SELECT id,dirty,revision,published_revision,published_at FROM bw_badges;
SELECT day,writes FROM bw_kv_budget ORDER BY day DESC LIMIT 7;
```

Para una devolución/cierre lícito, determinar qué derechos y saldo quedan, qué acciones se consumieron y qué apoyos afectan a terceros. No reactivar automáticamente bolsas con puntos impugnados ni considerar fraudulenta una reclamación por el mero hecho de existir. `bw_operations` es una cola interna de incidencias sin sistema externo de notificación todavía; el titular debe revisarla y observar las alertas del proveedor.

La política comercial del punto 14 se ha adaptado de la cobertura de [Outbid](https://outbid.lol/terms) al modelo de BadgeWars: no hay reembolsos voluntarios por ser superado o por resultados esperados, pero no se incorpora su ranking diario, un supuesto de compra directa de posición al recargar ni una exclusión de derechos obligatorios. Polar conserva sus facultades propias de devolución.

## Solicitudes por recarga no entregada

`POST /api/me/refund-request` exige sesión propietaria, Origin correcto y una referencia de recarga válida. Consulta el pedido autoritativo de Polar y comprueba aplicación, usuario, producto, moneda, importe y ausencia de reembolso previo. La SQL revalida dentro de la reserva: una recarga ya abonada, un gasto desde su inicio o deuda impiden la solicitud. La reserva congela el monedero y frena el abono de esa recarga mientras el expediente siga en review/submitted.

No hay endpoint público que ejecute dinero, cierre expedientes o descongele saldos. Revisar `bw_refund_requests` junto con `bw_operations`. Una devolución comercial se tramita manualmente en Polar solo tras verificar elegibilidad inmediatamente antes de ejecutarla; no basta la aprobación antigua de una solicitud. Guardar la referencia del resultado y conciliar su estado real. Mantener congelado hasta descartar otras deudas, reversiones, expedientes o apoyos impugnados.

Si se rechaza la solicitud por un fallo de entrega subsanable, documentar la decisión, cerrar el expediente y reanudar la conciliación del pedido correcto. Nunca editar/borrar el ledger ni añadir un segundo crédito manual. La reactivación requiere revisión administrativa de todas las incidencias y publicación de proyecciones. Esta revisión es manual; no hay todavía consola administrativa ni alertas externas automatizadas.

Una devolución obligatoria o impuesta por Polar debe conciliarse incluso si el usuario gastó BC: el saldo gastable no baja de cero, se registra deuda por el faltante y se suspende la cuenta para revisión. El control comercial de la app no puede impedir un chargeback o una decisión del MoR.
