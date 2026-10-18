# Inventario y Trust Bag en D1

Aplicar únicamente las migraciones actuales `0001` a `0006` a la D1 dedicada. Las tablas son `bw_*`; las migraciones de PostgreSQL conservadas en `legacy/` no pertenecen al despliegue actual.

`bw_user_badges` tiene `UNIQUE(user_id,badge)` e ID estable. Renovar un badge competitivo sube su nivel y conserva URL, sin generar una segunda ficha. La colección privada muestra la situación vigente, incluida una suspensión con motivo y contacto; no lista badges históricos. El libro de operaciones conserva evidencia financiera interna.

Activar Trust Bag cuesta 20 BC y no otorga puntos. El apoyo de otras cuentas consume desde 1 BC por punto; no hay autoapoyo ni pagos al titular. Cada contribuidor se agrupa por cuenta con su alias vigente y acumulado. La lista completa solo se consulta con la sesión del propietario. Por defecto publica cero alias; se pueden mostrar hasta cinco principales, sin emails ni cantidades individuales.

Los puntos se guardan como enteros decimales canónicos en TEXT. El trigger suma por dígitos y no pierde precisión más allá de Number. El ranking usa longitud y orden decimal; el cliente compara con aritmética exacta. Hay un límite de protección por aportación individual (100.000 BC), independiente del total de puntos, que no tiene límite de producto. Los empates favorecen la fecha de creación de la bolsa y luego su ID.

El SVG muestra posición y aspecto distinto para líder, podio, top 10 o perfiles con apoyo creciente. Cero puntos siempre indica que aún no existe apoyo, aunque por falta de rivales figure en primer puesto. No certifica calidad, seguridad o solvencia.

Las proyecciones KV y caché son eventualmente consistentes. Con cuotas disponibles, Trust Bag comparte metadatos durante diez segundos y SVG durante quince; otras familias usan 300 segundos. No hay garantía de purga instantánea global. El ranking informa de su última publicación; la colección se refresca cada minuto mientras está visible y los formularios no se reinician durante el sondeo.

Generar código requiere cuenta, propiedad y estado activo en D1; solo se ofrece desde la colección. El SVG sí es público y puede ser copiado manualmente por terceros: Internet no ofrece una protección absoluta contra la copia de imágenes públicas. Una suspensión corta nuevas inserciones verificadas y retira el badge de las siguientes proyecciones; las cachés de terceros pueden conservar la imagen anterior.
