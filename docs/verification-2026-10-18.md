# Verificación del 18 de octubre de 2026

## Confirmado

- Worker con D1 y KV nativos en un entorno local de pruebas separado. Las seis migraciones se aplican correctamente.
- 41 pruebas automatizadas: operaciones atómicas, concurrencia, saldo, idempotencia, Genesis, puntos exactos, privacidad, OAuth simulado, webhooks y documentos legales. Comprobación de sintaxis y compilación sin desplegar.
- Conexión con la API real de **Polar Sandbox**, producto de recarga privada en EUR/USD y token temporal con `checkouts:read`, `checkouts:write`, `orders:read`, caducidad de un día. Las credenciales permanecen únicamente en `.dev.vars`, ignorado por Git.
- Compra simulada completada por el titular: 5 EUR de base + 1,05 EUR de IVA español = 6,05 EUR de total. El monedero recibió exactamente 5 BC; no se cobraron fondos reales.
- Cuatro eventos reales de Sandbox (`order.paid` y `order.updated`) recibieron HTTP 202 y terminaron en estado completo. Solo se insertó un abono en el ledger. No hubo incidencias de conciliación.
- Factura PDF de Sandbox generada, descargada y revisada: emisor «BadgeWars via Polar Software, Inc.», base 5 EUR, IVA 21 %, total 6,05 EUR. Es documentación de prueba, no una factura de una venta real. La recepción del email y el acceso del comprador al portal requieren confirmación del titular.
- 40 variantes de inserción desde una página en otro origen local: cinco badges × dos idiomas × dos estilos × HTML/Markdown. Las 40 imágenes cargaron correctamente en el navegador sin sesión en los SVG. Se comprobaron CORS, idioma, HEAD y ETag/304.
- El generador exige la sesión del propietario. Una cuenta ajena recibe 404 y una petición sin sesión recibe 401. Renovar mantiene la URL y una sola ficha actual por badge; el incremento de dos niveles consumió solo 2 BC.
- Trust Bag cambió del puesto 1 al 2 en la misma URL, con revisión y ETag nuevos tras la publicación. Esta prueba respeta el intervalo de publicación; no demuestra una purga mundial instantánea ni controla la caché de GitHub.
- El relay temporal de webhooks solo acepta POST a `/api/polar/webhook`. Portada, términos y explorador local devuelven 404 desde Internet; una firma falsa devuelve 403.
- Condiciones ES/EN `2026-10-18-r4`: excepción comercial por recarga cobrada y no abonada correctamente, con revisión; se conservan derechos obligatorios y facultades de Polar. Los documentos previamente aceptados no se reescriben.

## Aún no verificado en servicios reales

- OAuth de Google/GitHub: faltan aplicaciones y claves. Las cuentas de integración son ficticias; no se ha probado todavía el recorrido completo con una identidad social real.
- Recargas pagadas en USD, cantidades de 15 BC y libres; fallos/3DS del proveedor y una compra posterior desde una sesión social real. La validación automatizada de estas ramas no sustituye la prueba externa.
- Reembolso externo parcial/total y documento rectificativo. La prueba propuesta afecta únicamente al pedido simulado y requiere autorización expresa como excepción a la política comercial.
- Dominio, D1/KV remotos, despliegue, cron y observabilidad en Cloudflare. El entorno nativo local no confirma estos recursos remotos.
- Aceptación comercial del modelo por Polar para producción, alta de recursos de producción y revisión jurídica/fiscal definitiva.

## Repetir las comprobaciones locales de inserción

Usar una D1 local de QA sin datos reales y con espacio para dos nuevas ediciones Genesis. Cada ejecución crea cuentas ficticias nuevas; no ejecutar contra producción. Los scripts están fijados a loopback y a `.wrangler/qa-state`.

```powershell
pnpm exec wrangler d1 migrations apply badgewars --local --persist-to .wrangler/qa-state
pnpm exec wrangler dev --local --port 8788 --persist-to .wrangler/qa-state --test-scheduled
# En otra terminal, con APP_URL=http://127.0.0.1:8788 en .dev.vars:
node scripts/qa-embeds.mjs
node scripts/qa-embed-server.mjs
# Página externa de pruebas: http://127.0.0.1:8790/
node scripts/qa-rank-refresh.mjs
```

Las claves oficiales de prueba de Turnstile se admiten únicamente con entorno `sandbox` explícito y `APP_URL` de loopback. No habilitan pagos en un dominio desplegado ni en producción. Véase [Cloudflare: claves de prueba](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

Los informes, capturas, bases, documentos de referencia y exportaciones privadas se conservan localmente y están excluidos del repositorio. El relay y el túnel son temporales; no son la infraestructura de producción.
