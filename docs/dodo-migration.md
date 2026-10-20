# Migración a Dodo Payments · estado 0.11.1

Estado del **21 de octubre de 2026**: **Dodo aprobado y conexión Live preparada**, publicada con recargas deshabilitadas. Producto, identidad y banco aprobados en el panel; catálogo, clave y firma Live instalados. El lanzamiento permanece pausado por decisión del titular. [Estado y activación](dodo-live-activation.md).

## Despliegue y alcance comprobados

| Elemento | Resultado |
|---|---|
| Worker publicado | Preparación Live publicada con interruptor de nuevas recargas a `false`; incluye los controles de [C](block-c-verification.md), adaptación legal [D](block-d-legal-review.md) y [cambios de badges](badge-seasons.md). |
| Base de datos | Quince migraciones en D1 remota; 0015 conserva contratos anteriores y registra por separado precio EUR, cobro convertido y base reembolsable. No requiere otra migración para habilitar Live. Exportación protegida localmente y restauración aislada comprobada. [Bloque C](block-c-verification.md). |
| Configuración desplegada | `DODO_PAYMENTS_ENVIRONMENT=live_mode` con **`DODO_CHECKOUT_ENABLED=false`**. Workers Free y correo/contraseña desactivado. Producto único EUR con Adaptive Currency, clave de permisos limitados y webhook Live verificados; sin checkouts ni cobros reales. |
| API pública y documentos | `/api/legal` devuelve condiciones `2026-10-21-r11` y Dodo Payments. `/api/payments/status` confirma recargas pausadas y mínimo 5 BC. Las cinco páginas legales incluyen ES/EN en HTML sin JavaScript; los justificantes aceptados antes conservan su versión. |
| Webhooks | `/api/dodo/webhook` rechaza cuerpos sin firma con 403; ver las entregas firmadas en el informe de test. |
| Pruebas automáticas | **98 correctas** y **66 comprobaciones de sintaxis**. Incluye reversiones, aislamiento, suspensión de SVG cacheados, temporadas, controles operativos y bloqueo explícito de nuevas recargas sin interrumpir conciliación ni portal. |
| Runtime | Compilación y ejecución local en workerd con bindings nativos, además de comprobaciones HTTP en el dominio público. |
| Pruebas reales Dodo | **Ejecutadas**: compra EUR/USD de 5 BC, IVA, webhook firmado y reentrega, gasto/renovación, SVG, portal, factura, emails y devolución total/parcial. [Informe y límites](dodo-test-verification.md). |
| Verificación comercial | Aprobada, confirmada por el titular y observada en el panel el 20/10/2026. Referencia auténtica guardada como secreto del Worker; sin inventar un número de expediente. |

Evidencias locales excluidas de Git: `artifacts/dodo-verification-submitted-2026-10-19.png`, `artifacts/dodo-live-refund-policy-2026-10-19.png`, copia previa de D1 y textos del formulario. No publicar capturas con datos bancarios, documentos de identidad ni credenciales.

## Implementación

El Worker importa `src/billing.mjs`, que expone exclusivamente `src/dodo.mjs`. Se usa el SDK oficial `dodopayments` fijado a **2.55.0**, con entorno explícito, timeout de ocho segundos y sin reintentos automáticos de creación incierta. Se han eliminado el adaptador de pagos anterior, sus pruebas y su documentación. Las migraciones ya aplicadas conservan su secuencia; 0011 elimina las ramas de compatibilidad de los triggers y rechaza nuevas filas de pago ajenas a Dodo. Los secretos anteriores se retiraron de los ficheros locales activos y se conservaron únicamente en un archivo local ignorado; no se revocaron credenciales de terceros ni se borraron registros históricos.

### Checkout y saldo

- Un producto de compra única: una unidad BC por 100 céntimos EUR de referencia. Dodo Adaptive Currency permite pagar en sus monedas admitidas, según país y método, sin fijar un segundo precio USD. Cantidad elegida en servidor, mínimo 5 y máximo 100.000 BC por recarga. No se crea una suscripción.
- Antes del checkout se verifica el producto remoto: negocio e ID correctos, precio fijo, moneda, impuestos exclusivos, sin descuentos, PPP, precio editable ni concesión automática de créditos Dodo.
- `checkoutSessions.create` envía la cantidad validada, producto EUR, metadatos de precio base y retorno a `/api/checkout/return`. Omite la moneda de cobro fija y permite elegir moneda mediante Dodo; los cupones permanecen desactivados. Los retornos limpian la URL y nunca acreditan saldo.
- **D1 es la única autoridad de BC**. No se mantiene un segundo saldo de entitlements Dodo ni se deducen créditos mediante contadores remotos asíncronos. El ledger y los triggers mantienen gasto, actualización e inventario atómicos.
- Cada recarga conserva consentimiento, su documento completo y versión, suministro inmediato y mayoría de edad. La versión actual es r11; las condiciones aceptadas anteriores no se reescriben.
- Los identificadores de pedidos, eventos y ledger incorporan proveedor/entorno. La recuperación nueva solo consulta Dodo del entorno actual.

### Avisos, recuperación y devoluciones

`/api/dodo/webhook` limita el cuerpo, verifica los bytes originales mediante `client.webhooks.unwrap` y comprueba el negocio. Solo después conserva un identificador/estado en el inbox de D1. No almacena cuerpos completos con datos de facturación. Los duplicados se deduplican antes de procesarse; el abono conserva su propia idempotencia transaccional.

Se reciben `payment.succeeded`, `payment.failed`, `payment.cancelled`, `payment.processing`, `refund.succeeded`, `refund.failed` y `dispute.opened`, `dispute.expired`, `dispute.accepted`, `dispute.cancelled`, `dispute.challenged`, `dispute.won`, `dispute.lost`. Antes de acreditar se consulta el pago actual de Dodo y se valida negocio, entorno, metadatos/cuenta, producto, cantidad, metadatos EUR y sesión autoritativa. En EUR se exige la base exacta; las cantidades extranjeras se obtienen exclusivamente del pago autenticado de Dodo. Se conserva el importe/moneda cobrado y se rechazan cambios posteriores. Los eventos no se aplican en función de un orden de llegada supuesto.

Cron recupera sesiones abiertas y vuelve a consultar pagos ya acreditados en lotes, con revisiones programadas cada doce horas. Esto permite detectar reembolsos cuyo webhook se perdió. Una creación de checkout de resultado incierto pasa a revisión; no se repite a ciegas.

Los reembolsos Dodo son importes brutos: se separa proporcionalmente la base de los impuestos y se conservan fracciones para revisión, sin redondear en perjuicio del comprador. Un reembolso se revierte una vez; si ya hubo consumo, el saldo gastable queda como mínimo en cero, el faltante se registra como deuda y se congela la cuenta. Los apoyos financiados desde esa cuenta pueden suspenderse para revisión. Reembolsos pendientes y disputas abiertas también producen una reserva/revisión. Una disputa favorable posterior no libera automáticamente otras deudas o bloqueos.

El estado autoritativo `refund_status=full` revierte todos los BC del pago, sin depender de la representación monetaria de cada registro de devolución. Para parciales se usa la moneda y base original de `retrieveLineItems`, que pueden ser distintas de la moneda pagada e incluir redondeos diferentes del total cobrado. Se guarda esa base inmutable y se calcula la proporción en enteros desde la reducción del saldo reembolsable de la línea (su importe ya incluye el impuesto), sin inventar tipos de cambio ni redondear BC al alza. Importes ausentes, monedas no verificadas o estado parcial sin detalle congelan el acceso para revisión, sin acreditar una recarga no entregada.

**Operación manual:** preferir el panel y revisar base, impuestos y total antes de confirmar. La API vigente ofrece devoluciones por `items` obtenidos con `payments.retrieveLineItems`; el SDK/documentación han cambiado de forma y no debe enviarse un `amount` raíz de una receta antigua ni pasar directamente el importe interno. Se probó una parcial USD de 242 céntimos con `tax_inclusive: true`. La ampliación FX comprobó abonos de 5 BC con USD y JPY, una parcial USD de 224 centavos que revierte 2 BC y la liquidación JPY en USD. La parcial JPY se completó en un único reintento tras el rechazo inicial de saldo del monedero test: 354 JPY devueltos al comprador, reducción de 224 centavos en la línea USD y reversión exacta de 2 BC. Ver [informe FX](dodo-fx-verification.md). La app no implementa devoluciones monetarias automáticas.

La solicitud comercial de devolución por recarga no abonada comprueba propiedad, pago real, falta de abono, ausencia de consumo posterior, deuda y fondos insuficientes. Una reserva atómica impide que compita con gasto o entrega posteriores. **No ejecuta un reembolso monetario automático**. Los derechos obligatorios y las decisiones de Dodo se concilian incluso tras consumo; la app no puede impedir un contracargo.

### Facturas y privacidad

El primer checkout crea un cliente Dodo distinto para esa cuenta; después se reutiliza exclusivamente una referencia previamente asociada a ella. No se vinculan perfiles por coincidencia del correo de facturación. Si compras simultáneas originan varios perfiles propios, el área privada permite elegirlos para acceder a sus documentos. Los enlaces de portal se crean en servidor solo para una referencia de cliente del usuario autenticado y del entorno actual; no se publican ni se almacenan como enlaces permanentes en KV. Se valida el dominio de retorno del portal.

Dodo será el vendedor de la transacción y emisor de factura/recibo según la entidad que figure en el checkout. SergioTech.es sigue siendo titular y proveedor del servicio. Los justificantes operativos de BadgeWars no duplican la factura fiscal. No se almacena numeración completa de tarjetas ni CVC.

## Presentación y políticas ES/EN

- Servicio descrito como **SaaS de gamificación y personalización mediante API**, con SVG personal, URL estable, colección privada y código propio de inserción.
- BC se define como crédito de consumo del software, sin valor monetario externo, moneda de curso legal, canje por efectivo, cashback, retirada, reventa ni transferencias entre cuentas. El precio de compra no se presenta como tipo de rescate.
- Rankings y Trust Bag se explican como niveles o apoyo **pagados**. No se afirma una auditoría independiente, certificación profesional ni una garantía de prevención de bots por cobrar créditos.
- Se conserva la política comercial sin reembolsos voluntarios y su excepción por recarga no abonada. No se introduce una renuncia general a derechos obligatorios ni se considera consumido todo el saldo en el instante de recargar.
- `/refunds` tiene página propia y enlaces en navegación legal, pie y compra. Los documentos y enlaces también se sirven en HTML para revisión sin ejecutar JavaScript. El checkout alojado no se carga durante la navegación ordinaria; no se inventan nombres o duración de cookies de terceros.

El texto pegado por el usuario se revisó como propuesta, no como prueba de aprobación de Dodo. No se incorporaron sus garantías de elegibilidad, ausencia de riesgo o protección absoluta frente a contracargos, ni su afirmación de que una recarga consume inmediatamente todo el servicio. Ver [política de aceptación de Dodo](https://docs.dodopayments.com/miscellaneous/merchant-acceptance), [créditos](https://docs.dodopayments.com/features/credit-based-billing) y [TRLGCU, artículos 102–103](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555#a103).

## Configuración pendiente antes de cobrar

| Configuración | Condición de cierre |
|---|---|
| Verificación Dodo | **Aprobado**, confirmado por el titular y observado en el panel el 20/10/2026: producto, identidad y banco aprobados. Referencia real registrada; no implica activación de cobros. |
| Cuenta y productos | **Live preparado**: un producto activo SaaS, 1 BC por 1 EUR base y pago adaptativo, impuestos aparte. Lectura autenticada del catálogo correcta con clave Live; mínimo de la aplicación 5 BC. |
| Secretos | `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`; las claves del panel pueden ser opacas y sin prefijo de entorno; solo en archivos ignorados para pruebas y secretos de Cloudflare en producción. |
| Identificadores | `DODO_BUSINESS_ID` y `DODO_PRODUCT_ID_EUR`, del mismo entorno. El anterior producto fijo USD está archivado. |
| Avisos externos | Webhook Live permanente instalado con trece eventos. Comprobación firmada sin efectos económicos 202; cuerpo alterado 403. El relay de QA sigue desactivado. Falta únicamente la entrega de un pago real al lanzar. |
| QA Dodo | Circuito test y ampliación B comprobados. Verificar un cobro y sus documentos definitivos en live con intervención del titular, según E. |
| Turnstile y producción | Claves reales, aprobación documentada en `DODO_LIVE_APPROVAL_REFERENCE`, `DODO_PAYMENTS_ENVIRONMENT=live_mode` y API key Live. **`DODO_CHECKOUT_ENABLED=false` durante la preparación**; solo `true` tras autorización de lanzamiento. La conciliación y el portal continúan durante una pausa. |
| Estado global | Google/GitHub públicos y bloques B/C comprobados. Correo/contraseña diferido hasta Paid; revisión legal/fiscal D y activación live E en el [plan A–E](review-and-launch.md). |

Las comprobaciones externas de Dodo se detallan en [dodo-test-verification.md](dodo-test-verification.md). Ningún cobro real se ha habilitado. [Preparación y secuencia de activación Live](dodo-live-activation.md).

La suspensión también se comprueba contra D1 primaria antes de servir un SVG personal cacheado. Se entrega una tarjeta de pausa sin rango/propietario, con `X-Badge-Status: suspended`, y un enlace limpio para gestionar la incidencia. No se conserva caché HTTP externa de las respuestas personales.
