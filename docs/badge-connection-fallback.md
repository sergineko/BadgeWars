# Badges cuando falla la conexión del visitante

Implementado y comprobado el **19 de octubre de 2026**. Forma parte del bloque B del [plan de lanzamiento](review-and-launch.md); no añade un nuevo bloque.

## Formato HTML con protección de conexión

El área personal ofrece por defecto **HTML con protección de conexión** (`format=html-safe` en el endpoint privado de generación). Conserva la URL personal dinámica y el enlace `/b/<id>`, y añade una tarjeta SVG neutral incluida directamente en el HTML de la web que lo publica.

El SVG remoto se dibuja en una capa de imagen CSS sobre esa tarjeta. Durante una carga pendiente o si no llega una imagen válida, la capa no pinta y se ve **Estado sin verificar / Status unverified**. No hay un elemento `<img>` que muestre un icono roto, JavaScript, dominio auxiliar, segundo servidor de fallback ni almacenamiento de un ranking antiguo. La tarjeta está disponible incluso en la primera visita si la web anfitriona sí carga, aunque el navegador no pueda acceder a BadgeWars.

El código solo se genera para el propietario autenticado de un badge activo y con su monedero al corriente. Si una petición alcanza nuestra API y el badge está suspendido, el SVG de pausa sustituye al activo. Si la conexión impide consultar el estado, la alternativa neutral no presenta rango, puntos, aportaciones ni acreditación vigente.

## Compatibilidad y límites

- La web anfitriona debe conservar el SVG inline, el `span` y los estilos del código. Su CSP debe permitir la imagen de `badgewars.com`; para políticas estrictas, el administrador puede trasladar los estilos a su CSS autorizado. No hace falta permitir JavaScript ni `object-src`.
- Markdown/GitHub y el HTML simple se mantienen como formatos separados. No tienen esta protección: un `<img src>` aislado no puede sustituirse si el bloqueo impide recibir cualquier respuesta del servidor. GitHub también controla su proxy/caché de imágenes y sanea el HTML.
- Los códigos ya copiados en otras webs no cambian automáticamente. Para esta protección hay que reemplazarlos por el nuevo formato desde la colección del propietario.
- El enlace a BadgeWars puede seguir inaccesible para un visitante afectado. La tarjeta evita el fallo visual; no identifica con certeza al ISP responsable ni restablece una conexión bloqueada. Un navegador no puede distinguir de forma fiable todos los bloqueos, fallos DNS, caídas y problemas de red.
- No garantiza una imagen alternativa si tampoco carga la propia web anfitriona, si esta elimina el código, si una respuesta interceptada proporciona una imagen válida diferente o si el visitante usa una copia ya descargada fuera de nuestro control.

## Comprobación realizada

`node scripts/qa-embed-fallback.mjs` abre un servidor local de página en 8794 y fixtures de imágenes en 8795. Son puertos y cuentas de prueba, sin operaciones financieras. Se inspeccionaron visualmente los formatos grande/compacto:

| Caso | Resultado observado |
|---|---|
| Conexión disponible | Badge dinámico de prueba visible |
| Conexión rechazada a otro puerto | Tarjeta local, sin icono roto |
| Respuesta HTTP 503 | Tarjeta local, sin ranking |
| Solicitud sin respuesta | Tarjeta visible durante la espera |
| SVG de suspensión | Tarjeta de pausa, sin recuperar el badge activo |
| Alternativa en inglés | Texto y enlace localizados |

No se ha probado desde una línea real bloqueada por Vodafone/LaLiga ni se afirma que exista un bloqueo actual de BadgeWars. Las pruebas reproducen fallos de carga, no una política concreta de un operador. Las capturas e informes de QA quedan en `artifacts/`, fuera de Git.

Las pruebas automáticas cubren generación privada, exclusión de propietarios ajenos, suspensión/deuda, localización y ausencia de código ejecutable o datos de rango en la alternativa. Resultado del proyecto: **66 tests y 51 comprobaciones de sintaxis superados**.

Desplegado en el Worker de producción: `31e96f58-c979-4dfe-9bfc-87e564b5d408`. La generación del código continúa en `/api/me/embed`, con sesión y propiedad obligatorias; no se ha publicado una herramienta de copia de badges ajenos ni los fixtures de prueba.
