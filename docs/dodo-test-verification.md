# Verificación de Dodo Payments · 19 de octubre de 2026

Las comprobaciones siguientes usan la API real de **Dodo test mode** y el Worker con **D1 y KV nativos locales, aislados de producción**. Son transacciones simuladas: no se mueve dinero real ni se conceden BC en la base pública.

## Configuración preparada

- Dos productos SaaS de compra única, EUR y USD, sin suscripción, descuentos, PPP ni derechos de crédito Dodo. Cada unidad representa 1 BC; el servidor crea las sesiones desde **5 unidades / 5 EUR o USD de base**, más impuestos. Los gastos internos de BC no generan operaciones Dodo.
- Credencial de test autenticada contra `test.dodopayments.com`, limitada a los recursos necesarios y conservada en `.dev.vars.dodo-test`, excluido de Git. Las claves del panel pueden ser opacas: no se deduce el entorno a partir de un prefijo.
- Endpoint temporal mediante un relay que solo expone el POST firmado de Dodo. Trece tipos de eventos configurados. El relay no publica la interfaz, los archivos de QA ni el explorador de D1.
- Los productos, la clave, el secreto de firma y los clientes de test no son credenciales ni recursos live. Producción sigue sin claves de cobro y sin aprobación comercial registrada.

## Resultados externos y nativos

| Comprobación | Resultado |
|---|---|
| Compra mínima EUR | 5 BC, base 5 EUR, IVA de la dirección española de prueba 1,05 EUR, total 6,05 EUR. Pago simulado confirmado. |
| Compra mínima USD | 5 BC, base 5 USD, IVA 1,05 USD, total 6,05 USD. Pago simulado confirmado. |
| Abono | Exactamente 5 BC por cuenta, mediante webhook firmado y consulta autoritativa del pago. Los impuestos no se convierten en BC. |
| Separación de cuentas | Dos cuentas ficticias y dos clientes de facturación independientes, incluso usando el mismo correo de recepción. El portal de una cuenta rechaza el cliente de la otra. |
| Compra de badge | Apex Flex adquirido por 1 BC; la otra cuenta lo supera con 2 BC. Renovar a nivel 3 consume solo 2 BC adicionales. |
| Inventario e idempotencia | Una sola ficha por cuenta/familia; repetir la referencia no vuelve a gastar. La URL personal del SVG se conserva al renovar. |
| Inserción | Códigos HTML y Markdown del propietario cargan el SVG desde otro origen local, con CORS y sin sesión en la imagen. El generador privado rechaza anónimos y otras cuentas. La ampliación posterior del [bloque B](block-b-verification.md) verifica además web HTTPS y README de GitHub. |
| Portal | Botón real de la colección abre el portal Dodo del cliente correcto. Se corrigió el envío de POST vacío que impedía abrirlo desde la interfaz. |
| Facturas | PDFs EUR/USD descargados y revisados visualmente: cinco unidades, base, IVA y total separados, marca BadgeWars y entidad MoR de Dodo. Son documentos de test. |
| Emails | El titular confirmó la recepción de los dos emails de compra en el correo de soporte reenviado a su buzón profesional. |
| Política comercial | Una solicitud de devolución después de gastar BC se rechaza. No se cambia esta regla por las excepciones técnicas de test autorizadas a continuación. |
| Devolución total EUR | Excepción ficticia expresamente autorizada: Dodo devuelve 6,05 EUR. Tras gastar 3 de los 5 BC, queda saldo gastable 0, deuda 3 y cuenta bloqueada. |
| Devolución parcial USD | Excepción ficticia autorizada: 2,42 USD brutos, incluidos 0,42 de impuesto, revierten 2 BC. La cuenta que gastó 2 BC conserva saldo 1, deuda 0 y queda bloqueada para revisión. |
| Documentos de devolución | Recibos PDF total y parcial obtenidos de Dodo y revisados visualmente. No se emiten facturas duplicadas desde BadgeWars. |
| Webhooks | Dos `payment.succeeded` y dos `refund.succeeded` conservados como completos. Reentrega real de un aviso de pago, después del reembolso, aceptada sin otro abono ni reversión. |
| Recuperación | Reconciliación nativa por cron repetida tras los reembolsos, sin duplicar movimientos. Los escenarios de avisos perdidos, desordenados y firmas falsas también tienen pruebas automáticas. |

## Suspensión y tarjeta de estado

El badge válido se bloquea antes de consultar el render cacheado. Cada petición personal comprueba en **D1 primaria**, mediante índices por identificador, que la ficha esté activa y el monedero sin bloqueo ni deuda. Esto también se aplica a HEAD y a peticiones con un ETag anterior. Si D1 falla, no se sirve un badge activo desde caché.

En lugar de una imagen rota, se entrega una **tarjeta SVG inactiva «Badge en pausa»**, ES/EN y completa/compacta. No contiene propietario, rango, puntos ni certificación. Usa HTTP 200 para poder dibujarse en un `<img>`, `X-Badge-Status: suspended` para consumidores de API y `Cache-Control: no-store`. Nunca se devuelve el render activo ni un 304 durante la suspensión. La generación privada del código permanece bloqueada.

El código HTML/Markdown nuevo enlaza a `/b/<identificador>`. Este enlace consulta el estado actual: un badge activo lleva a su acción habitual; uno suspendido lleva a `/collection`, donde el titular puede identificarse, revisar la incidencia y contactar con soporte para regularizar el pago. No incluye saldo, correo ni datos de pago en la URL. La ficha y el identificador se conservan; resolver una incidencia no reactiva automáticamente otras deudas o revisiones.

Verificado con la devolución real de test y con **40 variantes de URL** de las cinco familias en pruebas automáticas, conservando KV y renders deliberadamente obsoletos. Una imagen que un servicio externo ya haya descargado o copiado no puede retirarse de ese tercero desde nuestro endpoint.

## Alcance y pendientes

- **69 pruebas automáticas correctas y 55 comprobaciones de sintaxis tras la ampliación B**. Se han retirado el adaptador, las pruebas y la documentación del proveedor descartado. Las migraciones SQL ya aplicadas se conservan como secuencia histórica; 0011 retira los triggers de compatibilidad y rechaza nuevas operaciones ajenas a Dodo.
- El endpoint temporal quedó desactivado en Dodo al terminar y se detuvo el túnel público. La vista local de QA se conserva para revisión. Antes de cobrar hay que registrar el endpoint live permanente y configurar productos, claves y firma del mismo entorno. La aceptación comercial de Dodo sigue pendiente.
- La [ampliación B](block-b-verification.md) añade rechazos reales de test, solicitud `force_3ds`, factura empresarial con NIF ficticio, parcial EUR y SVG personal en web/GitHub externos. El simulador no presentó un reto 3DS interactivo; la comprobación bancaria y los documentos reales corresponden a E.
- Google público, GitHub y Turnstile ya están comprobados. Correo/contraseña queda preparado hasta Paid; C, D y E mantienen su alcance en la [tabla de lanzamiento](review-and-launch.md).

## Repetición local

`scripts/qa-dodo-setup.mjs` prepara configuración y cuentas ficticias en `.wrangler/dodo-qa/`, con identificadores de D1/KV distintos de producción. No desplegar el harness de acceso local. Aplicar las migraciones con `--local`, arrancar el Worker en 8792 con almacenamiento aislado y registrar un webhook de test mediante relay firmado. Tras confirmar las dos compras de 5 BC, `scripts/qa-dodo-flow.mjs` comprueba consumo, renovación, códigos, aislamiento y portal. El script no confirma pagos ni ejecuta devoluciones monetarias.

Las credenciales, clientes, sesiones de portal, cuerpos de pago, PDFs, informes JSON y capturas permanecen en rutas locales ignoradas. No copiar `.dev.vars.dodo-test` a producción ni publicar esos archivos.

## Publicación inicial de esta verificación

Versión 0.10.1 publicada en `badgewars.com`: Worker `33175f1e-6f72-4823-ad90-28e01b189012`, once migraciones remotas. Comprobación posterior: cero recargas, pedidos y asientos de pago en D1 de producción; ninguna fila de QA importada. Los cobros live permanecen desactivados.
