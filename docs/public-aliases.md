# Alias públicos por cuenta

Publicado el 21 de octubre de 2026. En **Mis badges** se puede definir o cambiar el alias que aparece en los badges, clasificaciones y aportaciones. Se muestra la fecha y hora del próximo cambio disponible.

- Un alias por cuenta, entre 2 y 24 caracteres ASCII: letras, números y `_`. Se conserva la escritura elegida, pero la unicidad no distingue mayúsculas: `Sergio` y `sergio` identifican el mismo nombre disponible.
- Definirlo por primera vez o modificarlo inicia un bloqueo de **14 días completos**. Cambiar solo mayúsculas cuenta como modificación. Guardar exactamente el mismo alias no reinicia ni elimina el bloqueo. El prefijo técnico `bw_user_` está reservado para migraciones.
- Antes de adquirir un badge o aportar puntos es necesario definirlo. Las operaciones utilizan el alias de la cuenta; el formulario de compra no permite elegir otro nombre. El nombre recibido de Google/GitHub sigue siendo un dato de la cuenta y no sobrescribe el alias al volver a iniciar sesión.
- Se conservan los identificadores y URL personales, las fechas, importes, puntos, números Genesis y posiciones. Las clasificaciones cerradas muestran el alias vigente sin recalcular el resultado. Los justificantes históricos de operaciones permanecen intactos.
- Se actualizan también los alias de contribuidores, tanto en la lista privada como en los hasta cinco nombres que el titular haya autorizado publicar. El cambio no altera la privacidad de esa lista.

## Implementación y límites

`0016_public_alias.sql` añade `bw_users.public_alias`, su índice único sin distinción de mayúsculas y la fecha del último cambio. D1 valida el plazo y evita dos reservas simultáneas. Una edición concurrente con una compra no puede publicar un alias antiguo o de otra cuenta: la transacción se rechaza sin descontar BC.

`GET/POST /api/me/profile` requiere la sesión del titular. POST comprueba el origen, limita intentos y utiliza la hora de la base de datos. No acepta un identificador de cuenta del cliente. Las respuestas son privadas y no se guardan en caché. La edición queda pausada en modo mantenimiento. La colección devuelve también los datos actuales del perfil utilizando la consulta de identidad que ya realiza, sin otra consulta periódica.

Las vistas públicas leen el alias actual mediante el identificador de la cuenta. Las proyecciones afectadas quedan pendientes de publicación y conservan los límites compartidos de KV. Los rankings públicos y las copias externas pueden tardar en actualizarse según caché y publicación. Los SVG personales comprueban el alias vigente en la misma lectura de elegibilidad que ya necesitan y cambian su clave de caché y ETag: una imagen antigua no puede responder 304 al nuevo alias. La suspensión por revisión de pagos sigue prevaleciendo.

Los códigos de inserción mantienen la misma URL. El texto alternativo que ya esté copiado en un HTML/README externo es estático; para actualizar también ese texto hay que volver a copiar el código. No es necesario cambiar la URL del SVG.

La migración preserva un alias válido de inventarios antiguos cuando puede ser único. Los conflictos o nombres inválidos reciben una identidad técnica distinta y se permite su primera elección manual inmediata. No se reescriben compras, resultados, contribuidores ni saldo. En la base de producción revisada no había badges ni acciones anteriores que renombrar.

## Verificación

**107 pruebas y 71 comprobaciones de sintaxis correctas.** Incluyen duplicados por mayúsculas, solicitudes simultáneas, bloqueo y frontera de 14 días, validación de sesión/origen, intentos de suplantación, acceso OAuth posterior, nombres actualizados en los cinco SVG con KV antigua, privacidad de contribuidores, conservación de resultados cerrados y migración con colisiones.

La interfaz ES/EN se comprobó en una cuenta local aislada con el Worker y D1 reales: rechazo de nombre ocupado, guardado, actualización de los cinco badges y bloqueo con fecha. No se cambió el alias de ninguna cuenta real para realizar la prueba. Antes de migrar producción se verificó la migración sobre una copia y se conservó una copia cifrada con DPAPI en `.wrangler/`, fuera de Git.
