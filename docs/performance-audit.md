# PageSpeed y navegación pública

Revisión publicada el **21 de octubre de 2026** sobre `https://badgewars.com/`. Lighthouse 13.5.0, móvil Moto G Power con 4G lenta y escritorio emulado. Son mediciones de laboratorio de la portada; PageSpeed todavía no dispone de datos CrUX suficientes de visitantes reales. No equivalen a una certificación de accesibilidad ni a una garantía de posición en buscadores.

| Categoría | Móvil antes | Móvil después | Escritorio antes | Escritorio después |
|---|---:|---:|---:|---:|
| Rendimiento | 73 | **97** | 94 | **100** |
| Accesibilidad automática | 96 | **100** | 96 | **100** |
| Prácticas recomendadas | 100 | **100** | 100 | **100** |
| SEO técnico automático | 91 | **100** | 91 | **100** |
| Navegación agéntica | 1/4 | **4/4** | 1/4 | **4/4** |
| Saltos de contenido, CLS | 0,971 | **0** | 0,146 | **0** |
| LCP | 2,4 s | **2,3 s** | 0,6 s | **0,6 s** |
| FCP | 1,2 s | 1,9 s | 0,4 s | 0,4 s |
| Bloqueo del hilo principal | 0 ms | 0 ms | 10 ms | 20 ms |
| Speed Index | 1,3 s | 2,7 s | 0,4 s | 0,9 s |

[Informe inicial](https://pagespeed.web.dev/analysis/https-badgewars-com/ldbic69lst?form_factor=mobile) · [Informe posterior móvil](https://pagespeed.web.dev/analysis/https-badgewars-com/kp7winjre7?form_factor=mobile) · [Informe posterior escritorio](https://pagespeed.web.dev/analysis/https-badgewars-com/kp7winjre7?form_factor=desktop).

La mejora principal está en la estabilidad, no en prometer que todas las métricas bajan. Antes, la primera pintura correspondía a un texto provisional bilingüe que después se sustituía por toda la portada; ese reemplazo producía 0,864 de CLS móvil y el cambio de fuentes añadía otro 0,107. Ahora la primera pintura contiene la portada real y no se registra ningún salto en esta medición. Las métricas varían entre ejecuciones y condiciones de red.

## Correcciones publicadas

- **HTML inicial real:** portada, cinco listados y acceso a colección generados durante la compilación con las mismas funciones de vista que usa el cliente. No se incrustan cuentas, saldos, códigos privados ni clasificaciones desactualizadas. Precios y acciones requieren todavía la respuesta vigente del servidor. El renderizado estático no añade consultas a D1 ni invocaciones del Worker por visita.
- **Fuentes y estilos:** conversión sin pérdida de las ocho fuentes TTF a WOFF2, conservando sus licencias; el conjunto pasa de 470.508 a 182.180 bytes, aproximadamente un 61 % menos. Carga anticipada de las dos fuentes principales y `font-display: optional` para evitar intercambios tardíos. Una hoja CSS generada elimina la cadena de `@import` y las siete hojas separadas del documento inicial. Fuentes con caché inmutable; HTML con revalidación.
- **Accesibilidad:** contraste corregido en «Cómo funciona», enlace de salto al contenido, marcas decorativas ocultas a lectores de pantalla, respeto a movimiento reducido y jerarquía de encabezados de las páginas legales. Se comprobó el salto por teclado sin ensuciar la URL y el cierre con Escape del diálogo de acceso, devolviendo el foco al botón.
- **SEO:** `robots.txt` válido, sitemap de rutas públicas y metadatos/canonical propios por página. La colección y las rutas privadas tienen `noindex` y quedan fuera del sitemap. Los canonical y metadatos se actualizan también al navegar sin recargar.
- **Descubrimiento para agentes:** `llms.txt` con descripción fiel de las mecánicas, enlaces y limitaciones; manifiestos JSON en `/.well-known/ard.json` y en la ruta anterior `/.well-known/ai-catalog.json`. Solo anuncian documentación y la API pública de lectura. No conceden permisos sobre cuentas, pagos o códigos privados, ni cambian la política de rastreo o entrenamiento por sí mismos.

Los tres recursos de descubrimiento devolvían antes el HTML genérico por el fallback de la aplicación. Ahora devuelven sus contenidos y tipos correctos. ARD y la categoría agéntica de Lighthouse siguen evolucionando: [especificación ARD](https://agenticresourcediscovery.org/spec/) y [auditoría oficial de llms.txt](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt).

## Verificación y mantenimiento

**101 pruebas automáticas y 69 comprobaciones de sintaxis correctas.** Verificados además HTTPS, tipos de los archivos públicos, rutas directas sin parámetros, navegación ES/EN, colección sin indexación, páginas legales, endpoints SVG, monitor operativo y proveedores Google/GitHub. Las recargas continúan desactivadas: `topupsEnabled=false`, mínimo 5 BC, referencia EUR y conversión adaptativa.

El informe posterior aún identifica oportunidades informativas, especialmente la hoja de estilos que bloquea la primera pintura en 4G lenta y tareas de renderizado en escritorio. No se ha aplazado CSS necesario a costa de reintroducir saltos visuales. Los avisos de CSP/HSTS/COOP/Trusted Types se deben estudiar con sus integraciones y alcance; no son fallos puntuados en este informe de prácticas recomendadas. No se modificó el modo SSL «Completo» elegido por el titular.

Para modificar diseño o contenido, editar las vistas y estilos fuente y ejecutar `pnpm build`. Se regenera el HTML de entrada y `public/site.css`; Wrangler ejecuta esa misma compilación antes de desplegar. No editar manualmente esos archivos generados. Las capturas y las transcripciones locales de las métricas se guardan en `artifacts/pagespeed/`, excluido de Git.
