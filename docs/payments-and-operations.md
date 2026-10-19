# Pagos y operación · Dodo Payments 0.10

Estado actual: verificación de Dodo enviada y en revisión; cobros públicos desactivados. La integración activa es Dodo y el saldo reside únicamente en D1. [Implementación, pruebas, variables y límites](dodo-migration.md) · [pendientes de lanzamiento](review-and-launch.md#tabla-de-pendientes) · [ficha comercial presentada](dodo-model-review.md).

## Servicio y partes

SergioTech.es opera BadgeWars, su SaaS de SVG dinámicos por API y el consumo de BC. Dodo será el Merchant of Record de la recarga según la entidad identificada en checkout/factura; gestiona el cobro, los impuestos de esa venta y los documentos del comprador. El titular conserva sus obligaciones propias de actividad, ingresos, privacidad y soporte. BadgeWars solo emite justificantes operativos, sin duplicar la factura fiscal de Dodo.

Los BC solo sirven para funciones del software. El precio de adquisición no implica canje por efectivo. No hay retirada, cashback, transferencias entre cuentas, reventa ni pagos a titulares de badges. Las excepciones legales de reembolso y las decisiones del MoR se respetan. Trust Bag refleja apoyo pagado, no una auditoría o certificación independiente.

## Conciliación y entrega

El retorno del navegador no acredita saldo. Un webhook se verifica por sus bytes originales y negocio, se conserva en D1 y provoca la consulta del pago actual. Validar entorno, referencia/cuenta, producto, cantidad, moneda, base, sesión y estado. El abono y su referencia son idempotentes. Cron recupera eventos y revisa pagos acreditados en lotes. Proveedor/entorno forman parte de la identidad de los registros; no procesar un pago Polar como si fuera Dodo.

No cambiar el importe o los metadatos de una recarga local para hacerla coincidir con un pago extraño. Registrar la incidencia en `bw_operations`, mantener el estado de revisión y comprobar el proveedor. Una creación de checkout incierta no debe repetirse con una clave nueva para forzar el resultado.

## Revisión comercial por recarga no entregada

La API privada `/api/me/refund-request` solo reserva una revisión: exige sesión/propiedad, pago real, falta de abono, ausencia de consumo desde el inicio de la recarga, deuda o saldo insuficiente. La reserva vuelve a comprobar estas condiciones en D1 y bloquea gasto y entrega concurrentes. No devuelve dinero ni sustituye los derechos legales del consumidor.

Antes de decidir, volver a consultar el pago, los reembolsos/disputas, el ledger y `bw_refund_requests`. Si procede corregir la entrega, cerrar de forma controlada la reserva y conciliar el pago, evitando que compita con una devolución. Si procede devolver, efectuar la operación desde el panel autorizado de Dodo, conservar la referencia y confirmar su resultado antes de cerrar. Una respuesta incierta se investiga antes de volver a ejecutarla. No restablecer el acceso mientras existan otras deudas, reversiones, solicitudes o apoyos impugnados. No hay consola administrativa ni ejecución automática de devoluciones en BadgeWars.

Una reversión obligatoria se concilia incluso tras consumo: el saldo gastable queda en cero como mínimo, el faltante se registra como deuda y se congela la cuenta para revisión. Los badges propios y los apoyos financiados pueden suspenderse; Genesis conserva su número. Las fracciones y monedas de reembolso que no se puedan conciliar exactamente permanecen en revisión. Una disputa ganada no elimina otros bloqueos automáticamente.

Advertencia operativa concreta: la API Dodo expresa el `amount` de entrada de devoluciones parciales en céntimos de USD, también para pagos en otras monedas. `bw_refund_requests.amount` es la base original de la recarga y no debe pasarse directamente a ese parámetro. Revisar la vista previa de Dodo con base, impuestos y total; ver su [guía oficial](https://docs.dodopayments.com/features/transactions/refunds).

## Facturas y evidencias

El portal se crea en servidor para una referencia de cliente del usuario autenticado y del entorno actual. No vincular cuentas por email ni publicar enlaces privados en KV. Si una compra simultánea creó varios perfiles propios, el área permite elegirlos. Antes de lanzamiento comprobar factura, recibo, rectificación, emails y perfil de empresa en Dodo con una compra real de test mode. Las facturas anteriores de Polar Sandbox no verifican Dodo.

Conservar documentos aceptados, referencias, estados y resultado de revisiones. No escribir cuerpos completos de webhook, CVC, tarjetas, tokens o datos bancarios en logs. La copia previa de D1 y las credenciales se excluyen de Git. Ensayar una restauración aislada y reconciliar con el proveedor: restaurar D1 no deshace un cobro externo.

## Historial

El Word original proponía Polar y un saldo único. Se mantuvo el modelo BC confirmado por el titular; Polar rechazó su onboarding. La versión anterior de este procedimiento está archivada en [legacy/payments](../legacy/payments/operations-polar.md), junto al adaptador histórico. Las pruebas reales de Polar se conservan como evidencia de aquella integración, no como autorización ni pruebas externas de Dodo.
