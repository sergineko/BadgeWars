# Bloque B · Pruebas finales en test

Comprobado el **19 de octubre de 2026**. Cuatro cuentas ficticias independientes, Dodo `test_mode` y D1/KV nativos locales aislados. No se han importado saldos, pedidos, clientes de prueba ni sesiones en D1 de producción. Los cobros live siguen desactivados.

| Caso | Resultado observado |
|---|---|
| Rechazo de tarjeta | Pago de 5 USD + 1,05 USD de impuesto: `failed / CARD_DECLINED`. Cero BC y cero asientos de abono. |
| Fondos insuficientes | Pago de 5 USD + 1,05 USD: `failed / INSUFFICIENT_FUNDS`. Cero BC y cero asientos de abono. |
| Solicitud 3DS | Checkout USD enviado con `force_3ds: true`: pago simulado correcto de 6,05 USD y exactamente 5 BC. El simulador no presentó un reto bancario interactivo; no se declara comprobada su introducción, cancelación ni una autenticación SCA real. |
| Empresa/NIF-IVA | Checkout con razón social y NIF ficticios: base 5 EUR, impuesto 0 en test y 5 BC abonados. PDF descargado, renderizado y revisado: razón social, dirección, Tax ID, cinco unidades, total y mención de inversión del sujeto pasivo. Emisor: Dodopay Payments Limited. No equivale a validación VIES ni acredita el tratamiento fiscal de una empresa real. |
| Parcial EUR | Excepción de test autorizada: devolución de 2 EUR, estado `succeeded`, reversión de exactamente 2 BC. Saldo restante 3 BC, deuda 0 y bloqueo para revisión. Conciliación repetida sin otra reversión. La política comercial no cambia. |
| Portal empresarial | Generado mediante la API privada para el cliente asociado a esa cuenta. El portal muestra su compra de 5 EUR, descarga de factura y devolución de 2 EUR; no mezcla los otros clientes de prueba. |
| Badge personal | La cuenta del pago USD adquiere Apex Flex por 1 BC y conserva 4 BC. Los códigos se generan desde su sesión privada. SVG HTTPS activo, personalizado y sin parámetros públicos. |
| Web externa | HTML estándar y HTML con protección de conexión muestran el SVG dinámico en una página HTTPS alojada fuera del equipo. La imagen viene del Worker local a través de un relay público restringido, no de un archivo estático de demostración. |
| README externo | Markdown generado por la API privada, publicado y renderizado en GitHub: imagen 600 × 280 cargada por `camo.githubusercontent.com`. [Capturas archivadas](qa-embed-readme.md). |

## Corrección encontrada durante QA

Los pagos fallidos no añadían créditos, pero la recarga seguía marcada como pendiente. Ahora se conservan `failed` y `cancelled`, el recibo ES/EN explica que no se han añadido BC y estos intentos salen de los movimientos pendientes. Un aviso antiguo no sobrescribe una recarga aceptada o en revisión.

Se vuelve a consultar un checkout rechazado durante su ventana de 24 horas para recuperar un eventual pago correcto aunque se pierda su webhook. Después se deja de consultar periódicamente; un webhook posterior válido sigue siendo reconciliable. Solo el pago autoritativo, con sus metadatos y cantidades verificados, permite abonar una vez. Los rechazos no bloquean el monedero.

**69 pruebas automáticas y 55 comprobaciones de sintaxis correctas.** Incluyen estados terminales sin abono, recuperación posterior sin duplicación, protección de una revisión existente y cierre del seguimiento periódico de rechazos antiguos.

## Límites y trazabilidad

- En esta ampliación se utilizó la consulta autoritativa de Dodo a través del cron nativo. No se creó un nuevo destino de webhooks. El circuito de firma, entrega real y duplicados ya está documentado en la [primera verificación](dodo-test-verification.md).
- La solicitud inicial de devolución por MCP devolvió `409 Insufficient funds in wallet`, sin crear una devolución. El panel de Dodo mostró y procesó los 2 EUR correctos; la lectura posterior de la API confirmó 200 céntimos EUR y `succeeded`. No se reintentó ciegamente una operación incierta ni se modificó saldo para fingir el resultado.
- El fixture empresarial necesitó razón social **y** NIF para crear el checkout. La primera validación fallida no concedió BC; se corrigió el fixture tras consultar al proveedor y se conservó su referencia original. El expediente local de preparación no se ha borrado.
- La página externa temporal se publicó con el Worker normal y los bindings de producción. El acceso local de QA y sus secretos **no se desplegaron**. El relay solo permite GET/HEAD del badge ficticio y su enlace; las APIs, archivos y explorador local devuelven 404.
- Tras guardar evidencia se retiran página y túnel. Se conserva el Markdown archivado con capturas, sin depender de una URL temporal. Las cachés y sanitizadores de terceros pueden retrasar actualizaciones; Markdown no ofrece la protección de conexión del HTML con SVG inline.
- El desafío bancario real, los documentos fiscales reales y el cobro de producción pertenecen al **bloque E** al activar live. Estas pruebas no son aprobación de Dodo ni revisión legal/fiscal profesional.

## Repetición

`scripts/qa-dodo-b-setup.mjs` genera cuatro identidades ficticias y configuración local en `.wrangler/dodo-qa-b`, negándose a sobrescribir un ensayo anterior. Aplicar las once migraciones solo con `--local` y almacenamiento `.wrangler/dodo-qa-b-state`, arrancar en 8798 y ejecutar `scripts/qa-dodo-b-checkouts.mjs`. Los botones de pago y cualquier devolución requieren autorización específica; los scripts no los confirman.

`scripts/qa-dodo-b-status.mjs` consulta el entorno test explícito y guarda respuestas privadas en `.wrangler` e informe reducido en `artifacts`. Para el ensayo externo, `scripts/qa-dodo-b-relay.mjs` requiere la compra ficticia guardada en `purchase.json`; `QA_PUBLIC_ORIGIN` admite exclusivamente una URL HTTPS temporal de `trycloudflare.com` para generar códigos. Nunca desplegar el entry point local ni copiar sus variables a producción. PDFs, sesiones de portal, claves y datos de clientes permanecen ignorados por Git.

## Publicación y limpieza

Corrección publicada en `badgewars.com`, Worker **`f80f3cb4-3ff0-416a-a4b5-d66629a39f61`**. Los módulos públicos coinciden con el código local. Página temporal retirada y evidencia archivada en el repositorio. Se detienen el túnel y el relay al finalizar; el entorno nativo de QA permanece solo en loopback para reproducir la prueba.

Consulta posterior en D1 remota: **0 recargas, 0 pedidos, 0 asientos y 0 badges personales**. Sin migraciones ni fixtures financieros nuevos en producción, sin contratación de Workers Paid y sin activar cobros live.
