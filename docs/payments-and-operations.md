# Pagos y operación · Dodo Payments 0.10

Estado actual: verificación de Dodo enviada y en revisión; cobros públicos desactivados. La integración activa es Dodo y el saldo reside únicamente en D1. [Implementación, pruebas, variables y límites](dodo-migration.md) · [plan A–E](review-and-launch.md) · [ficha comercial presentada](dodo-model-review.md) · [operación e incidencias](operations-runbook.md).

## Servicio y partes

SergioTech.es opera BadgeWars, su SaaS de SVG dinámicos por API y el consumo de BC. Dodo será el Merchant of Record de la recarga según la entidad identificada en checkout/factura; gestiona el cobro, los impuestos de esa venta y los documentos del comprador. El titular conserva sus obligaciones propias de actividad, ingresos, privacidad y soporte. BadgeWars solo emite justificantes operativos, sin duplicar la factura fiscal de Dodo.

Los BC solo sirven para funciones del software. El precio de adquisición no implica canje por efectivo. No hay retirada, cashback, transferencias entre cuentas, reventa ni pagos a titulares de badges. Las excepciones legales de reembolso y las decisiones del MoR se respetan. Trust Bag refleja apoyo pagado, no una auditoría o certificación independiente.

## Conciliación y entrega

El retorno del navegador no acredita saldo. Un webhook se verifica por sus bytes originales y negocio, se conserva en D1 y provoca la consulta del pago actual. Validar entorno, referencia/cuenta, producto, cantidad, moneda, base, sesión y estado. El abono y su referencia son idempotentes. Cron recupera eventos y revisa pagos acreditados en lotes. Proveedor/entorno forman parte de la identidad de los registros; no reutilizar referencias de otro entorno.

No cambiar el importe o los metadatos de una recarga local para hacerla coincidir con un pago extraño. Registrar la incidencia en `bw_operations`, mantener el estado de revisión y comprobar el proveedor. Una creación de checkout incierta no debe repetirse con una clave nueva para forzar el resultado.

## Revisión comercial por recarga no entregada

La API privada `/api/me/refund-request` solo reserva una revisión: exige sesión/propiedad, pago real, falta de abono, ausencia de consumo desde el inicio de la recarga, deuda o saldo insuficiente. La reserva vuelve a comprobar estas condiciones en D1 y bloquea gasto y entrega concurrentes. No devuelve dinero ni sustituye los derechos legales del consumidor.

Antes de decidir, volver a consultar el pago, los reembolsos/disputas, el ledger y `bw_refund_requests`. Si procede corregir la entrega, cerrar de forma controlada la reserva y conciliar el pago, evitando que compita con una devolución. Si procede devolver, efectuar la operación desde el panel autorizado de Dodo, conservar la referencia y confirmar su resultado antes de cerrar. Una respuesta incierta se investiga antes de volver a ejecutarla. No restablecer el acceso mientras existan otras deudas, reversiones, solicitudes o apoyos impugnados. No hay consola administrativa ni ejecución automática de devoluciones en BadgeWars.

Una reversión obligatoria se concilia incluso tras consumo: el saldo gastable queda en cero como mínimo, el faltante se registra como deuda y se congela la cuenta para revisión. Los badges propios y los apoyos financiados pueden suspenderse; Genesis conserva su número. Las fracciones y monedas de reembolso que no se puedan conciliar exactamente permanecen en revisión. Una disputa ganada no elimina otros bloqueos automáticamente.

Para devoluciones parciales por API, usar la forma vigente por `items`, consultar antes `payments.retrieveLineItems` y comprobar moneda, base, impuestos y total. No reutilizar recetas antiguas de `amount` raíz ni pasar directamente `bw_refund_requests.amount`. La prueba realizada usa 242 céntimos USD brutos con `tax_inclusive: true`; otras monedas requieren su propia comprobación. Preferir la vista previa del panel para una operación manual.

## Facturas y evidencias

El portal se crea en servidor para una referencia de cliente del usuario autenticado y del entorno actual. No vincular cuentas por email ni publicar enlaces privados en KV. Si una compra simultánea creó varios perfiles propios, el área permite elegirlos. Factura, recibo, emails, portal y perfil de empresa se comprobaron en Dodo test; los documentos definitivos se verifican con la compra live del bloque E. [Resultados de B](block-b-verification.md).

Conservar documentos aceptados, referencias, estados y resultado de revisiones. No escribir cuerpos completos de webhook, CVC, tarjetas, tokens o datos bancarios en logs. La copia previa de D1 y las credenciales se excluyen de Git. La restauración aislada ya se ensayó; restaurar D1 no deshace un cobro externo. El [procedimiento operativo](operations-runbook.md) define avisos, responsable, CLI de revisión y recuperación; [resultados de C](block-c-verification.md).


## Estado público tras incidencias

Un badge suspendido, una cuenta congelada o con deuda no sirven su SVG activo. La comprobación primaria precede a la caché. Se entrega una tarjeta inactiva ES/EN sin rango ni titular, con enlace `/b/<id>` hacia la colección para gestionar la incidencia y soporte. No reactivar sin conciliar pago, saldo, deuda, apoyos e incidentes pendientes. [Pruebas Dodo](dodo-test-verification.md).
