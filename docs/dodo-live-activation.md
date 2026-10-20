# Dodo aprobado · preparación sin cobros

Revisado el **21 de octubre de 2026**. El titular confirmó la aprobación y el panel de BadgeWars muestra **producto, identidad y cuenta bancaria aprobados**, con verificación completa observada el 20 de octubre. No se ha habilitado la recarga pública ni realizado un cobro real. La fecha de observación no pretende ser un número de expediente ni una autorización fiscal.

## Qué está preparado

- Circuito test EUR/USD, rechazos, reembolsos parciales/totales, idempotencia, suspensión y reactivación controlada, facturas y portal: comprobados con el alcance de [B](block-b-verification.md) y del [informe Dodo](dodo-test-verification.md).
- Google/GitHub, Turnstile, D1, KV, publicación de SVG, cron, alertas y recuperación: operativos. No es necesario contratar Workers Paid para lanzar con acceso social. Correo/contraseña continúa diferido con sus dependencias de envío y CPU.
- Interruptor **`DODO_CHECKOUT_ENABLED=false`**: impide crear nuevas sesiones tanto en la API como en la interfaz, incluso con la aprobación y las claves correctas. Live requiere expresamente `true`; un valor ausente o erróneo no habilita cobros. Las devoluciones, conciliación y acceso a documentos anteriores siguen funcionando al pausarlo.
- Comprobación pública sin datos privados: `GET /api/payments/status` devuelve entorno, disponibilidad y mínimo de **5 BC**. No publica claves, identificadores del negocio ni referencias de aprobación.
- Diagnóstico privado de solo lectura: `pnpm payments:preflight`. Consulta el producto, el webhook y vistas previas USD/JPY; no crea clientes, sesiones, enlaces, pagos ni otros recursos. `--offline` comprueba únicamente la configuración local.
- Precio vigente: **1 BC = 1 EUR de referencia**, con pago en las monedas admitidas por Dodo según país y método mediante Adaptive Currency. Mínimo 5 BC. El checkout muestra conversión, comisiones aplicables, impuestos y total. Los BC abonados son la cantidad elegida, independientemente de la moneda de pago. [Pruebas FX y sus límites](dodo-fx-verification.md).

## Configuración Live separada

Usar `.dev.vars.dodo-live` (ignorado por Git), tomando como guía [.dev.vars.dodo-live.example](../.dev.vars.dodo-live.example). El diagnóstico combina ese archivo con las variables públicas de Wrangler y los secretos locales de autenticación de `.dev.vars.production`; no imprime valores. No subir archivos privados ni copiar credenciales de test.

| Recurso | Configuración requerida |
|---|---|
| Negocio y aceptación | Identificador del negocio correcto y `DODO_LIVE_APPROVAL_REFERENCE` con referencia auténtica de la aprobación observada. |
| Catálogo adaptativo | Un producto Live de 1 BC por 100 céntimos EUR de referencia, categoría SaaS, compra única e impuestos aparte. Pago en las monedas disponibles mediante Adaptive Currency. Sin PPP, descuentos, precio editable ni abono automático de créditos de Dodo. La aplicación solo permite cantidades enteras desde 5 BC. No publicar enlaces directos de producto: el checkout autenticado enlaza pago, cuenta, aceptación y recarga. |
| Clave Live | Solo permisos necesarios para catálogo y consulta de pagos/reembolsos/disputas, checkouts y clientes/portal. Sin emisión de reembolsos, retiradas, transferencias ni administración del catálogo. Para el diagnóstico, lectura del webhook. |
| Webhook permanente | `https://badgewars.com/api/dodo/webhook`, con firma propia de Live y los trece eventos consumidos por el servidor. No reutilizar el relay de QA ni su clave revocada. |
| Servidor | API key y firma en secretos de Workers; identificadores/entorno en configuración del mismo despliegue. `DODO_CHECKOUT_ENABLED=false` durante toda la preparación. |

Eventos requeridos: `payment.succeeded`, `payment.failed`, `payment.cancelled`, `payment.processing`, `refund.succeeded`, `refund.failed`, `dispute.opened`, `dispute.expired`, `dispute.accepted`, `dispute.cancelled`, `dispute.challenged`, `dispute.won`, `dispute.lost`.

**Estado de recursos: preparado sin habilitar recargas.** El titular autorizó preparar Live sin activar cobros. Producto vigente: `pdt_0NqACN2zz8xE9mJa7W70K`, «BadgeWars — Software Credits», base EUR, sin etiqueta de moneda en nombre/descripción. El anterior producto fijo USD `pdt_0NqACMw9NkIeC0xK6kJbG` está archivado; USD sigue disponible mediante Adaptive Currency. La clave «BadgeWars Production» tiene siete recursos: pagos, reembolsos, disputas, productos y webhooks en lectura; clientes y sesiones de checkout en escritura (incluye lectura). No permite ejecutar devoluciones, gestionar catálogo ni alterar el webhook.

El endpoint `ep_3Ky7tHmyGLOpSQi9BCV7qIGK11B` está habilitado para los trece eventos indicados y usa su firma Live. API key, firma y referencia de aprobación se han instalado como secretos de Workers; los identificadores y `live_mode` están en Wrangler con **`DODO_CHECKOUT_ENABLED=false`**. Los archivos privados tienen acceso restringido al usuario de Windows y SYSTEM y están excluidos de Git. No se ha creado checkout ni enlace de pago real.

Comprobado en producción: `/api/payments/status` informa `live_mode`, `topupsEnabled:false`, `minimumCredits:5`, referencia EUR y pago adaptativo; salud 200 y accesos Google/GitHub disponibles. Una comprobación firmada **sin efectos económicos**, de tipo no consumido por la app, obtiene 202; el mismo cuerpo alterado obtiene 403. No se insertó una operación de pago ni se modificó saldo. Esto verifica la firma instalada y la ruta pública, **no sustituye la entrega de un pago real desde Dodo**. El diagnóstico privado de recursos devuelve todo correcto con recargas pausadas. **98 pruebas y 66 comprobaciones sintácticas correctas.**

## Activación cuando lo indique el titular

No realizar estos pasos hasta que el titular dé por resuelta su situación y autorice expresamente lanzar cobros.

**Comprobación nueva del proveedor:** la factura adaptativa USD suma 5,60 en la línea y 5,62 en subtotal/total, con impuesto cero. Pago y total coinciden; falta que Dodo aclare o corrija los dos centavos no desglosados. [Hallazgo y reproducción](dodo-fx-verification.md). No se presenta este PDF como plenamente reconciliado. El justificante privado de BadgeWars identifica explícitamente el precio de referencia y la moneda/importe real cobrado, y no se presenta como factura fiscal.

La guía de Cloudflare también está [revisada y documentada](cloudflare-domain-setup.md), con las opciones gratuitas compatibles y el modo Completo conservado por decisión del titular.

1. La preparación de claves, productos, firma y entorno Live ya está publicada con recargas pausadas. Cuando llegue el lanzamiento, repetir `pnpm payments:preflight` para comprobar que siguen vigentes y confirmar `/api/payments/status`, salud y acceso social. No hay que repetir migraciones ni importar nuevamente los productos.
2. Cambiar únicamente `DODO_CHECKOUT_ENABLED` a `true` en la configuración de producción y desplegar. No usar `MAINTENANCE_MODE` para pausar solo nuevas compras: detendría también operaciones ajenas a las recargas. Revisar `/api/payments/status`, hacer con el titular una primera compra real de **5 BC, referencia 5 EUR más conversión e impuestos aplicables**, y comprobar una sola entrada de saldo, webhook firmado, portal, factura/recibo y email real. La simulación previa no sustituye esos documentos ni la prueba bancaria real.
3. Confirmar el resultado y vigilar los avisos operativos. Las demás divisas usan el mismo producto y circuito; Dodo determina sus importes en ese momento. No convertir una devolución real en prueba sin autorización y causa; los ensayos de reversión se realizan en test.

Para volver a pausar **nuevas compras**, fijar `DODO_CHECKOUT_ENABLED=false` y desplegar sin retirar las claves Live ni deshabilitar el webhook. Las sesiones ya creadas en Dodo pueden seguir abiertas hasta su expiración: el interruptor impide crear otras, pero no cancela las anteriores. Conciliar cualquier pago pendiente y conservar saldo, facturas y evidencias.

Los cambios de producto, firma, permisos o dominio requieren repetir el diagnóstico correspondiente. Si una clave se revoca o caduca antes del lanzamiento, renovarla y comprobarla de nuevo; no prometer que una credencial guardada seguirá válida indefinidamente.

Fuentes: [entornos de Dodo](https://docs.dodopayments.com/miscellaneous/test-mode-vs-live-mode), [webhooks firmados](https://docs.dodopayments.com/developer-resources/webhooks). Cada entorno tiene productos, claves y webhooks separados; la aprobación de la cuenta no activa el interruptor de BadgeWars.
