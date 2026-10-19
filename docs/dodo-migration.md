# Migración a Dodo Payments · 0.10.1

Estado del **19 de octubre de 2026**: adaptación publicada en https://badgewars.com y solicitud de verificación recibida por Dodo. El panel muestra **«Estamos revisando tus datos»**, con plazo orientativo de hasta 72 horas. Producto y datos bancarios figuran registrados; identidad aprobada. Esto no equivale a aceptación comercial del modelo ni a activación de cobros.

## Despliegue y alcance comprobados

| Elemento | Resultado |
|---|---|
| Worker publicado | Versión final: `33175f1e-6f72-4823-ad90-28e01b189012`; 363,46 KiB / 98,16 KiB gzip; arranque comunicado por Cloudflare: 8 ms. |
| Base de datos | Once migraciones en D1 remota. Exportación de seguridad previa guardada localmente y excluida de Git. |
| Configuración desplegada | `DODO_PAYMENTS_ENVIRONMENT=test_mode`; Workers Free, correo/contraseña desactivado. Sin credenciales de cobro en producción. Productos EUR/USD, clave y webhook configurados solo para QA aislado. |
| API pública y documentos | `/api/legal` devuelve condiciones `2026-10-19-r8` y Dodo Payments. `/terms`, `/refunds`, `/privacy`, `/legal`, `/cookies`: HTTP 200, ES/EN en HTML sin JavaScript. |
| Webhooks | `/api/dodo/webhook` rechaza cuerpos sin firma con 403; ver las entregas firmadas en el informe de test. |
| Pruebas automáticas | **62 correctas** tras retirar pruebas del proveedor descartado; **49 comprobaciones de sintaxis**. Incluye reversiones, aislamiento y suspensión de SVG cacheados. |
| Runtime | Compilación y ejecución local en workerd con bindings nativos, además de comprobaciones HTTP en el dominio público. |
| Pruebas reales Dodo | **Ejecutadas**: compra EUR/USD de 5 BC, IVA, webhook firmado y reentrega, gasto/renovación, SVG, portal, factura, emails y devolución total/parcial. [Informe y límites](dodo-test-verification.md). |
| Verificación comercial | Ficha de producto corregida y guardada; el titular realizó el último envío que confirma la cuenta bancaria. Dodo muestra revisión en curso, sin decisión final ni referencia de aprobación. |

Evidencias locales excluidas de Git: `artifacts/dodo-verification-submitted-2026-10-19.png`, `artifacts/dodo-live-refund-policy-2026-10-19.png`, copia previa de D1 y textos del formulario. No publicar capturas con datos bancarios, documentos de identidad ni credenciales.

## Implementación

El Worker importa `src/billing.mjs`, que expone exclusivamente `src/dodo.mjs`. Se usa el SDK oficial `dodopayments` fijado a **2.55.0**, con entorno explícito, timeout de ocho segundos y sin reintentos automáticos de creación incierta. Se han eliminado el adaptador de pagos anterior, sus pruebas y su documentación. Las migraciones ya aplicadas conservan su secuencia; 0011 elimina las ramas de compatibilidad de los triggers y rechaza nuevas filas de pago ajenas a Dodo. Los secretos anteriores se retiraron de los ficheros locales activos y se conservaron únicamente en un archivo local ignorado; no se revocaron credenciales de terceros ni se borraron registros históricos.

### Checkout y saldo

- Dos productos de compra única: una unidad BC por 100 céntimos en EUR o USD. Cantidad elegida en servidor, mínimo 5 y máximo 100.000 BC por recarga. No se crea una suscripción.
- Antes del checkout se verifica el producto remoto: negocio e ID correctos, precio fijo, moneda, impuestos exclusivos, sin descuentos, PPP, precio editable ni concesión automática de créditos Dodo.
- `checkoutSessions.create` envía la cantidad y moneda validadas, metadatos de referencia y retorno a `/api/checkout/return`. Se desactivan selección de moneda y cupones en checkout. Los retornos limpian la URL y nunca acreditan saldo.
- **D1 es la única autoridad de BC**. No se mantiene un segundo saldo de entitlements Dodo ni se deducen créditos mediante contadores remotos asíncronos. El ledger y los triggers mantienen gasto, actualización e inventario atómicos.
- Cada recarga conserva consentimiento, condiciones r8 completas, suministro inmediato y mayoría de edad. Las condiciones aceptadas anteriores no se reescriben.
- Los identificadores de pedidos, eventos y ledger incorporan proveedor/entorno. La recuperación nueva solo consulta Dodo del entorno actual.

### Avisos, recuperación y devoluciones

`/api/dodo/webhook` limita el cuerpo, verifica los bytes originales mediante `client.webhooks.unwrap` y comprueba el negocio. Solo después conserva un identificador/estado en el inbox de D1. No almacena cuerpos completos con datos de facturación. Los duplicados se deduplican antes de procesarse; el abono conserva su propia idempotencia transaccional.

Se reciben `payment.succeeded`, `payment.failed`, `payment.cancelled`, `payment.processing`, `refund.succeeded`, `refund.failed` y `dispute.opened`, `dispute.expired`, `dispute.accepted`, `dispute.cancelled`, `dispute.challenged`, `dispute.won`, `dispute.lost`. Antes de acreditar se consulta el pago actual de Dodo y se valida negocio, entorno, metadatos/cuenta, producto, cantidad, moneda, base sin impuestos y sesión. Los eventos no se aplican en función de un orden de llegada supuesto.

Cron recupera sesiones abiertas y vuelve a consultar pagos ya acreditados en lotes, con revisiones programadas cada doce horas. Esto permite detectar reembolsos cuyo webhook se perdió. Una creación de checkout de resultado incierto pasa a revisión; no se repite a ciegas.

Los reembolsos Dodo son importes brutos: se separa proporcionalmente la base de los impuestos y se conservan fracciones para revisión, sin redondear en perjuicio del comprador. Un reembolso se revierte una vez; si ya hubo consumo, el saldo gastable queda como mínimo en cero, el faltante se registra como deuda y se congela la cuenta. Los apoyos financiados desde esa cuenta pueden suspenderse para revisión. Reembolsos pendientes y disputas abiertas también producen una reserva/revisión. Una disputa favorable posterior no libera automáticamente otras deudas o bloqueos.

El estado autoritativo `refund_status=full` revierte todos los BC del pago, sin depender de la representación monetaria de cada registro de devolución. Para parciales se valida la moneda de las cantidades recibidas; importes ausentes, moneda distinta o estado parcial sin detalle se congelan para revisión, sin acreditar una recarga no entregada. Es imprescindible comprobar esta representación en las pruebas reales de Dodo.

**Operación manual:** preferir el panel y revisar base, impuestos y total antes de confirmar. La API vigente ofrece devoluciones por `items` obtenidos con `payments.retrieveLineItems`; el SDK/documentación han cambiado de forma y no debe enviarse un `amount` raíz de una receta antigua ni pasar directamente el importe interno. Se probó una parcial USD de 242 céntimos con `tax_inclusive: true`. Otras monedas necesitan validación específica de unidades y vista previa. La app no implementa devoluciones monetarias automáticas.

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
| Verificación Dodo | Decisión comercial y condiciones reales sobre el modelo presentado; guardar referencia auténtica. El plazo de hasta 72 horas es orientativo del panel. |
| Cuenta y productos de test mode | Crear/verificar productos EUR/USD con las propiedades anteriores. Confirmar el entorno antes de cualquier escritura por el conector Dodo. |
| Secretos | `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`; las claves del panel pueden ser opacas y sin prefijo de entorno; solo en archivos ignorados para pruebas y secretos de Cloudflare en producción. |
| Identificadores | `DODO_BUSINESS_ID`, `DODO_PRODUCT_ID_EUR`, `DODO_PRODUCT_ID_USD`, del mismo entorno. |
| Avisos externos | Configurar el endpoint permanente o un relay local autorizado y probar los eventos con su firma real, reintentos y recuperación. |
| QA Dodo | Compra en EUR/USD, impuestos, abandono, reintento, duplicado, factura/portal/email, devolución parcial/total y después de consumo; las pruebas que generen una operación financiera requieren la intervención/autorización correspondiente. |
| Turnstile y producción | Claves reales, aprobación documentada en `DODO_LIVE_APPROVAL_REFERENCE`, `DODO_PAYMENTS_ENVIRONMENT=live_mode` y API key live. No usar un acuse de recepción como aprobación. |
| Otros pendientes | Google general, correo/contraseña, alertas, restauración y revisión legal/fiscal final permanecen en la [tabla de lanzamiento](review-and-launch.md#tabla-de-pendientes). |

Las comprobaciones externas de Dodo se detallan en [dodo-test-verification.md](dodo-test-verification.md). Ningún cobro real se ha habilitado.

La suspensión también se comprueba contra D1 primaria antes de servir un SVG personal cacheado. Se entrega una tarjeta de pausa sin rango/propietario, con `X-Badge-Status: suspended`, y un enlace limpio para gestionar la incidencia. No se conserva caché HTTP externa de las respuestas personales.
