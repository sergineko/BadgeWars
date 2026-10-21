# Referencia EUR y pago adaptativo · 21/10/2026

La regla vigente es **1 BC por 1 EUR de base**, recarga mínima 5 BC, con pago en las monedas admitidas por Dodo según país y método. Un único producto EUR con Adaptive Currency, sin precios alternativos USD, PPP ni cupones. El nombre comercial y su descripción no incorporan la etiqueta EUR; su precio de referencia sigue siendo EUR.

## Pruebas externas en Test

Compras autorizadas con tarjeta ficticia, cuentas y D1 aisladas de producción:

| Caso | Resultado |
|---|---|
| 5 BC, Estados Unidos, USD | Cobro simulado de **562 centavos USD**; acreditados exactamente **5 BC**, una sola vez. |
| 5 BC, Japón, JPY | Cobro simulado de **924 JPY**, moneda sin decimales; acreditados exactamente **5 BC**, una sola vez. |
| Parcial USD | Devolución ficticia autorizada de **224 centavos USD**, `succeeded`. Base reembolsable original: 560 centavos. Reversión exacta de **2 BC**, saldo **3 BC** y cuenta en revisión, sin duplicar al repetir conciliación. |
| Parcial de la compra JPY | Primer intento rechazado por saldo insuficiente del monedero Dodo test; tras comprobar que no existía devolución, un único reintento autorizado terminó en `succeeded`: **354 JPY** devueltos al comprador. La línea de liquidación USD pasó de 560 a 336 centavos reembolsables: reversión exacta de **2 BC**, saldo **3 BC** y cuenta en revisión. |

Importes observados, **no tipos de cambio prometidos**. Dodo aplica conversión, redondeo y fiscalidad. Facturas y portal se comprobaron en el circuito anterior; estas dos pruebas no se presentan como verificaciones fiscales de todos los países.

## Hallazgo aplicado

Ambos pagos devolvieron en `retrieveLineItems` moneda **USD**, importe original **560** e impuesto cero. El pago JPY informó moneda de cobro JPY y liquidación USD. Comparar el reembolso USD con el total JPY o con los 562 centavos cobrados produciría errores de unidades o redondeo.

Se conservan por separado precio EUR, importe/moneda cobrado y base/moneda reembolsable original. Las parciales se calculan con la reducción del saldo reembolsable de la línea, en su misma moneda y con aritmética entera: el importe devuelto al comprador puede haberse convertido otra vez a JPY. El importe original de la línea ya incluye su impuesto; no se suma dos veces. No se inventan tipos de cambio ni se redondean BC al alza. `refund_status=full` revierte todos los BC. Datos incompletos o cambios posteriores congelan el acceso para revisión.

Se validan sesión autoritativa, negocio, producto, cantidad, cuenta, entorno y metadatos EUR. El retorno del navegador no acredita saldo. La migración 0015 conserva como `fixed` las recargas anteriores y sus contratos; las nuevas usan `eur_fx_v1`. La confirmación privada de la app distingue `base_reference` de la moneda/importe real de cobro, conserva las unidades menores y declara `isTaxInvoice:false`.

## Cobertura y límites

**98 tests y 66 comprobaciones sintácticas correctos.** Incluye USD/JPY, redondeos, parciales con moneda de liquidación distinta, importes originales inmutables, impuestos contados una vez, lecturas concurrentes de devolución/pago, sesión ajena, metadatos alterados, precio EUR incorrecto, idempotencia, contratos históricos y pausa Live independiente de la conciliación.

El diagnóstico Live consulta producto, webhook y vistas previas USD/JPY sin crear sesiones. No se ha creado ni confirmado una compra real; producción permanece con `DODO_CHECKOUT_ENABLED=false`. La primera compra real y sus documentos se comprueban al autorizar el lanzamiento. Las respuestas con datos de facturación y capturas están en archivos locales ignorados, fuera del repositorio.

## Diferencia entre línea y total de la factura Dodo

Revisión visual del PDF original del pago USD: línea **5 × USD 1,12 = USD 5,60**, impuesto **USD 0,00**, pero subtotal y total del documento **USD 5,62**. La API confirma un cobro de 562 centavos y una base de línea de 560. Por tanto, el total del PDF coincide con el pago; queda una diferencia de **2 centavos sin línea explicativa** entre el detalle y el subtotal. No es IVA ni un recargo calculado por BadgeWars.

La documentación oficial indica redondeos internos y conversión sobre los importes, pero no demuestra que esos dos centavos concretos sean una comisión. La diferencia es compatible con convertir/redondear el total y el unitario por separado: **es una inferencia, pendiente de aclaración por Dodo**. No se ha editado su factura ni inventado un concepto fiscal. BadgeWars muestra la referencia EUR, conserva el total real informado por Dodo y acredita solo los BC elegidos. No reconstruye una factura multiplicando precios unitarios convertidos.

Antes de la primera venta real, queda que Dodo confirme o corrija el desglose de este supuesto adaptativo. El titular autorizó la consulta y se envió a su soporte privado el **21 de octubre de 2026**, con las referencias de test y el PDF original adjunto. El asistente de soporte indicó que lo pasa al equipo humano; todavía no hay respuesta técnica, corrección ni número de expediente comunicado. Se solicitó respuesta a `support@badgewars.com`.

## Comparación con el checkout directo · 21/10/2026

El flujo de BadgeWars ya utiliza `checkoutSessions.create` y redirige al checkout alojado por Dodo; la aplicación no calcula ni envía un importe convertido en USD. Se comparó con el [enlace estático oficial](https://docs.dodopayments.com/developer-resources/integration-guide#static-payment-links), abriendo `/buy/{producto de test}` con cantidad 5, país US y moneda USD, sin petición desde el servidor de BadgeWars.

| Circuito observado | Detalle de los 5 créditos | Subtotal | Impuestos | Total | Alcance |
|---|---|---|---|---|---|
| Factura original de la sesión creada por API | 5,60 USD | 5,62 USD | 0,00 USD | 5,62 USD | Pago simulado anterior y PDF original comprobados. |
| Resumen del checkout estático de Dodo | 5,60 USD | 5,60 USD | 0,00 USD | 5,62 USD | Diferencia visible antes de introducir datos del comprador o confirmar el pago. |

**El enlace directo también reproduce el desfase de dos centavos en la interfaz de Dodo.** No se completó otra compra ni se generó una factura nueva: esta comprobación acredita el problema del resumen del checkout, no el contenido de una segunda factura. Cambiar simplemente al enlace estático no elimina el problema observado.

Se añadió la reproducción al caso de soporte y se preguntó por la causa, su posible alcance en Live, el criterio de `retrieveLineItems` y una solución respaldada por Dodo. También se consultó si representar un pack como una única unidad evitaría un posible redondeo por unidad; **no está confirmado ni implementado como solución**. Los documentos, mensajes y captura del checkout quedan en archivos locales ignorados. No se han enviado credenciales ni datos bancarios. El circuito autenticado de recargas y la pausa Live siguen vigentes.

[Activación y pendientes](dodo-live-activation.md). [Documentación oficial de Adaptive Currency](https://docs.dodopayments.com/features/adaptive-currency).
