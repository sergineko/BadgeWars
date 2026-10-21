# BadgeWars

SaaS ES/EN de badges SVG dinámicos por API, rankings independientes y colección privada. Frontend ESM sin framework, Worker de Cloudflare y una **D1 dedicada** a BadgeWars. Versión 0.11.1.

**Lanzamiento:** [cinco bloques y criterios de cierre](docs/review-and-launch.md#plan-de-lanzamiento-cinco-bloques) · [consulta enviada a Freemius](docs/freemius-model-review.md) · [revisión de Dodo y precedente de Outbid](docs/dodo-model-review.md). Dodo ya está aprobado. Los cobros públicos permanecen desactivados por decisión del titular hasta su autorización de lanzamiento. [Preparación y activación Live](docs/dodo-live-activation.md).

## Desarrollo

Node 24 o posterior (las pruebas usan SQLite integrado):

```powershell
pnpm install
pnpm dev
```

`http://127.0.0.1:8787/` muestra datos ficticios y no acepta pagos ni sesiones reales. `pnpm dev:worker` ejecuta el Worker con bindings locales y `.dev.vars`; `pnpm db:migrate:local` aplica las migraciones únicamente a D1 local. Para usar pnpm 11 con esta configuración, indicar `--store-dir .pnpm-store` si el entorno restringe su almacén global.

```powershell
pnpm check
pnpm test
pnpm readiness
pnpm exec wrangler deploy --dry-run --outdir .wrangler/build
```

`readiness` devuelve código 2 cuando falta configuración. No imprime secretos ni verifica recursos remotos. Una compilación o prueba local correcta no activa la tienda.

`pnpm build` genera el HTML inicial de portada, cinco listados y colección desde las mismas vistas que utiliza el cliente, y agrupa el CSS en `public/site.css`. Se ejecuta también antes del despliegue. Edita las vistas y estilos fuente, no los archivos HTML/CSS generados. Las fuentes WOFF2 están incluidas con sus licencias; Python solo hace falta para regenerarlas opcionalmente con `scripts/convert-fonts.py` (fontTools y brotli).

La [revisión de PageSpeed](docs/performance-audit.md) recoge las mediciones, los cambios de accesibilidad y los archivos públicos para buscadores y agentes.

El [alias público por cuenta](docs/public-aliases.md) se gestiona desde Mis badges, es único sin distinguir mayúsculas y permite un cambio cada 14 días. Se aplica a badges, clasificaciones y aportaciones, conservando enlaces y resultados.

## Modelo actual

- Un saldo de BadgeCredits (BC) para funciones del software: **1 BC = 1 EUR de precio base**, con pago en las monedas admitidas por Dodo mediante Adaptive Currency. Recargas enteras desde 5 BC; conversión, comisiones, impuestos y total mostrados por Dodo Payments. Sin valor monetario externo, canje por efectivo, cashback, retiradas, transferencias ni pagos a titulares. Derechos obligatorios protegidos.
- Apex Flex: temporadas independientes desde 1 BC; la primera permanece abierta sin fecha de cierre. El cierre guarda posiciones inmutables y cada temporada adquirida conserva su SVG e identidad. Bait parte de 5 BC. En ambos, el mínimo competitivo supera al líder en 1 BC y renovar consume la diferencia frente al nivel propio (de esa temporada en Flex). Dos intentos del mismo nivel: gana el primero confirmado atómicamente; el segundo conserva íntegro su saldo, sin cargo ni devolución posterior.
- Build Funded: adquisición personal única de 50 BC, sin límite de unidades, transferencias ni renovaciones. El directorio muestra titulares y fecha de adquisición.
- Trust Bag: activación 20 BC. Otras cuentas aportan desde 1 BC por punto, sin límite de producto al total. Ranking exacto, incluso fuera de la precisión de Number. La lista de contribuidores es privada y su titular decide publicar de cero a cinco alias.
- Genesis: 1.000 BC, diez números como máximo, una edición por cuenta; jamás se reemite un número suspendido.
- Una ficha actual por cuenta y badge, o por temporada en Apex Flex; se conservan todas las temporadas adquiridas. Renovar conserva su identificador y URL. Generador de inserción solo para su propietario autenticado; el SVG resultante es público para funcionar en Internet.
- Google/GitHub OAuth con PKCE y estado de un uso en D1. No se conservan tokens sociales; sesiones opacas con hash, HttpOnly y Secure en HTTPS. Cada proveedor representa una cuenta distinta, sin vinculación automática por email.
- Correo/contraseña propios en D1 con scrypt y pepper, verificación, recuperación de un uso, revocación de sesiones y Turnstile. Preparado y probado localmente; producción desactivada hasta Workers Paid y Email Sending verificado.
- Google publicado en producción y probado con una cuenta fuera de la anterior lista de test; GitHub también comprobado. Workers Free se mantiene.
- Código personal HTML con protección de conexión: tarjeta SVG incluida en la web anfitriona cuando falla la imagen remota, sin icono roto ni ranking antiguo. Markdown/GitHub y HTML simple se conservan con sus límites. [Compatibilidad y pruebas](docs/badge-connection-fallback.md).
- Solicitud privada de revisión por recarga cobrada y no abonada: bloquea consumo posterior, abono previo, deuda y saldo insuficiente; no ejecuta devoluciones de dinero. Las reversiones impuestas por Dodo se concilian igualmente.
- Rutas limpias, sin filtros/idioma en la URL: `/leaderboard/flex`, `/leaderboard/bait`, `/leaderboard/funded`, `/leaderboard/trust`, `/leaderboard/genesis`, `/collection`, `/terms`, `/refunds`, `/privacy`, `/legal`, `/cookies`. Cada badge tiene su listado; Build Funded es un directorio sin posiciones, Genesis muestra propietarios por edición y Flex permite consultar `/leaderboard/flex/apex-1` y las temporadas que se publiquen. [Reglas y operación de temporadas](docs/badge-seasons.md). `/leaderboard` abre Flex y los callbacks técnicos limpian la dirección al redirigir. Las cinco páginas legales incluyen ES/EN en HTML sin JavaScript.
- Menú superior persistente al desplazarse; navegación interna sin recargar el documento ni mostrar una página intermedia de carga. Conserva Atrás/Adelante, posición de scroll y filtros independientes. La colección privada prepara sus datos manteniendo la vista anterior; descargas, OAuth y pagos conservan su flujo de servidor. Anclas ajustadas a la altura del menú y transiciones breves del contenido, respetando movimiento reducido.

## Infraestructura

D1 mantiene usuarios, sesiones, ledger inmutable, saldo, inventario, operaciones e inbox de webhooks. Los triggers ejecutan validación, débito y actualización en una operación atómica; las consultas compuestas usan `DB.batch()`. D1 no utiliza `SELECT FOR UPDATE` ni conexiones PostgreSQL.

Los rankings y el diseño de los SVG leen **KV + Cache API**. Los SVG personales de Flex leen también su posición/temporada en D1 para conservar el resultado final sin depender de la temporada más reciente. Cada SVG personal comprueba primero, mediante una consulta indexada a la D1 primaria, que el badge está activo y la cuenta sin bloqueo ni deuda. Una suspensión se impone también a los diseños ya cacheados y a GET/HEAD/304; si D1 no responde, se deniega la imagen. Las respuestas personales usan `no-store`, conservando solo la caché interna del render. Los archivos estáticos, incluidas las fuentes y sus licencias, se sirven desde Assets. Un publicador con lease conserva la marca `dirty` ante fallos y cron recupera el trabajo pendiente. Presupuesto propio de 900 publicaciones KV/día entre las cinco familias; al agotarse se aplaza la publicación, sin alterar el saldo en D1. La caché puede mostrar versiones anteriores; no hay purga global instantánea garantizada.

La caché de la API pública y del render interno de Trust Bag es corta (15 s, metadatos 10 s); otros renders y vistas generales usan 300 s. Las respuestas SVG personales al cliente son `no-store`; el control primario de suspensión se repite antes de utilizar cualquier render cacheado. Una petición servida por el Worker sigue contando aunque se resuelva en Cache API. Los límites gratuitos se comparten según el recurso/cuenta; hay que observar uso real. No se promete capacidad ilimitada a coste cero.

## Pagos y límites de lanzamiento

Dodo Payments es el único proveedor de pagos integrado. SDK oficial **2.55.0**, `checkoutSessions.create`, un producto de referencia EUR con Adaptive Currency y verificación criptográfica mediante `webhooks.unwrap`. Inbox durable, comprobación autoritativa del pago, idempotencia y recuperación por cron; D1 sigue siendo la única autoridad del saldo. Volver del checkout no acredita nada y recargar nunca compra un badge automáticamente. Reembolsos y disputas congelan la cuenta cuando procede; el saldo gastable nunca es negativo. No hay retirada ni devolución monetaria automática desde la app. [Migración, arquitectura, pruebas y configuración pendiente](docs/dodo-migration.md).

La verificación de Dodo, enviada el 19 de octubre, está **aprobada** según el titular y el panel consultado el **20 de octubre de 2026**: producto, identidad y banco aprobados. Catálogo, clave y webhook Live instalados y verificados, con `DODO_CHECKOUT_ENABLED=false`. El código exige entorno/key coherentes, productos, firma, Turnstile, referencia auténtica de aprobación y el interruptor explícito `true` antes de permitir nuevas recargas Live. **Los cobros públicos permanecen desactivados**; quedan la autorización de lanzamiento, activar el interruptor y comprobar una compra real con su abono y documentos definitivos. El circuito test, incluidas facturas, emails y portal, ya está comprobado. [Procedimiento y estado](docs/dodo-live-activation.md).

Ese mismo día se envió a Freemius una consulta del modelo completo, destacando la adquisición de un badge SVG personal actualizado por endpoint/API e incrustable en cualquier web con URL estable. El formulario confirmó la presentación; la respuesta comercial sigue pendiente. No se ha integrado ni contratado Freemius; [consulta y estado](docs/freemius-model-review.md).

La revisión del Word se documenta en [docs/payments-and-operations.md](docs/payments-and-operations.md). Los términos ES/EN describen mecánicas, derechos obligatorios y privacidad reales; no suponen una exención de obligaciones fiscales o de actividad del titular.

## Preparación del despliegue

Consultar [plan A–E](docs/review-and-launch.md), [pagos Dodo](docs/dodo-migration.md), [OAuth](docs/oauth-cloudflare.md) y [D1](docs/migration-d1.md). Worker publicado en [badgewars.com](https://badgewars.com), con catorce migraciones D1, KV inicializado, cron y accesos sociales probados. [Operación y recuperación](docs/operations-runbook.md): alertas agregadas, cuotas de solo lectura, monitor externo y restauración aislada comprobados en el [bloque C](docs/block-c-verification.md). Workers Free se conserva; correo/contraseña y cobros públicos siguen desactivados. [Activación del correo](docs/email-auth-and-domain.md).

Las pruebas de pagos Dodo en test mode, webhooks firmados, SVG, portal y facturas se documentan en [verificación Dodo](docs/dodo-test-verification.md). La [adaptación legal ES/EN r9](docs/block-d-legal-review.md) explica las cuentas en revisión. El [expediente fiscal](docs/legal-tax-handover.md) y el [registro de tratamientos](docs/privacy-register.md) están preparados para completar la validación del titular. El soporte será por email y vía postal, sin teléfono. Las credenciales, bases de QA, exportaciones, facturas y capturas permanecen fuera de Git.

`legacy/postgresql/` conservan infraestructura PostgreSQL anterior, desactivados y fuera del Worker activo. No ejecutar migraciones PostgreSQL en D1. Los registros y condiciones históricos no se convierten a Dodo ni se borran; los ficheros de demo no son registros financieros.
