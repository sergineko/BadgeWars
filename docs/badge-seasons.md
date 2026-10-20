# Build Funded y Apex Flex · 0.11.0

Cambios del 20 de octubre de 2026. Condiciones ES/EN `2026-10-20-r10`.

## Build Funded

- Adquisición personal única de **50 BC**. Unidades ilimitadas, una por cuenta.
- No hay líder, pujas, traspasos ni renovaciones. Las compras de otras cuentas no modifican badges ya adquiridos.
- `/leaderboard/funded` muestra únicamente el titular (con avatar) y la fecha de adquisición, con búsqueda y paginación. Sin puestos ni importes.
- El SVG identifica voluntariamente al titular como desarrollador; no certifica profesión, experiencia ni calidad técnica. El código se obtiene en la colección privada.
- Los titulares existentes conservan ID y fecha originales; la migración no modifica su historial de gasto.

## Apex Flex

La publicación empieza con una única clasificación abierta, sin fecha de cierre. Mientras solo exista esa primera clasificación, la interfaz y sus SVG **no muestran selector, numeración ni etiquetas de temporada**. El modelo interno y las condiciones sí permiten explicar y conservar futuras clasificaciones independientes. Al existir otra temporada, se muestran las etiquetas y el selector.

Cada temporada se identifica en `bw_flex_seasons`. Solo puede haber una abierta. Una cuenta tiene una ficha por temporada en `bw_user_badges`; renovar conserva ID y URL, y consume la diferencia con el nivel propio de esa misma temporada. Cada nueva temporada empieza desde 1 BC y no hereda descuentos de niveles anteriores.

Al cerrar, un trigger guarda en `bw_flex_results` la posición, nivel y alias de cada ficha. Las posiciones se calculan entre fichas activas con monedero habilitado, ordenadas por nivel descendente, fecha de adquisición del nivel e ID. Las no habilitadas al cierre no reciben posición final. Los resultados guardados no pueden actualizarse ni borrarse. Suspender después a un titular puede ocultarlo sin promover a los demás; reactivarlo conserva la posición final original.

Una fecha de cierre se debe anunciar por adelantado. La validación SQL impide consumir BC al llegar esa hora aunque el cron o la proyección se retrasen. Antes de aplicar una revisión de monedero o suspensión posterior al límite, se guarda el resultado pendiente de cierre. No hay inicio automático de otra temporada.

La colección conserva **todos los badges adquiridos**, incluidos los de temporadas cerradas. Solo ofrece renovar la ficha de la temporada abierta. Los códigos personales y URLs anteriores siguen disponibles con sus controles de pago/suspensión. El SVG personal de Flex lee su estado y posición en D1 primaria antes de usar un render cacheado, por lo que otra temporada o una caché KV antigua no sustituyen su resultado.

Con varias temporadas, el selector genera rutas limpias como `/leaderboard/flex/apex-1`. Buscar o paginar no cambia las posiciones. El Hall of Flex se limita a la clasificación más reciente y no mezcla temporadas ni Build Funded.

## Operación posterior

La gestión es mediante CLI privada con la autenticación existente de Wrangler, sin endpoint administrativo público:

```powershell
node scripts/seasons.mjs list --remote
```

`schedule` requiere `--id`, `--end` (fecha ISO futura con zona horaria), `--actor`, `--note` y `--confirm`. Publicar y comunicar la fecha antes de aplicarla. El cron cierra el periodo vencido; `close` también exige un límite ya transcurrido, no inventa un cierre retroactivo.

Antes de usar `open`, crear y verificar el **nuevo diseño SVG** y registrarlo en `public/seasons.js`. La CLI exige `--id`, `--design`, `--actor`, `--note` y `--confirm`; rechaza diseños no registrados, diseños reutilizados o que siga existiendo una temporada abierta. La temporada nueva requiere una publicación expresa; no basta con incrementar un número. Esta entrega solo registra el diseño original y no crea una segunda temporada pública.

Los cambios guardan autor, nota y estado en `bw_season_events`, con historial inmutable. Las proyecciones conservan el presupuesto de KV y el tratamiento de fallos del bloque C. Los SVG/leaderboards de terceros pueden tardar en actualizarse; no se promete una purga global instantánea.

## Migración y validación

`0014_badge_seasons.sql` cambia la unicidad del inventario conservando IDs, fechas, contribuidores, acciones y saldos. Asigna las fichas Flex existentes a la primera temporada. La migración difiere restricciones durante la reconstrucción, verifica referencias y falla ante una relación inválida antes de restaurar su validación. No reinicia inventario ni movimientos financieros.

Se probaron:

- Doce propietarios simultáneos de Build Funded al precio fijo; duplicados y sobreofertas sin débito.
- Cierre, inmutabilidad, renovación, nueva temporada, intento tardío y reintento de una operación anterior sin duplicar consumo.
- Conservación de dos fichas y del código/URL de la antigua; SVG con posición final y suspensión impuesta incluso con render cacheado.
- Ausencia de etiquetas de temporada en los dos estilos SVG iniciales y aparición al existir otra temporada.
- Revisión financiera después del límite y antes del cron sin alterar el resultado final.
- Migración de una base poblada con fichas y contribuidores; comprobación de claves foráneas.
- Aplicación nativa de las catorce migraciones en D1 local aislada; navegación ES/EN, selector, directorio y colección con datos ficticios.

Las temporadas adicionales y las cuentas de QA son exclusivamente locales. No se importan en producción ni se realizan nuevos pagos de Dodo. Los cobros live y correo/contraseña mantienen sus dependencias de lanzamiento existentes.

Referencia técnica: [restricciones y migraciones D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

## Publicación verificada

Publicado en `badgewars.com`, versión Worker `023b4259-0f3f-41bf-9f8e-e4b707b3def3`. Catorce migraciones remotas aplicadas; comprobación de claves foráneas sin incidencias. La base conserva sus tres cuentas y no contiene pedidos, movimientos ni badges de QA. La única temporada pública es la primera, abierta y sin fecha; `showSeason=false`.

**86 pruebas automáticas y 64 comprobaciones de sintaxis correctas.** Salud pública 200 después de publicar las proyecciones; SVG y assets ES/EN verificados. Portada y leaderboard inicial comprobados en el navegador sin textos ni filtro de temporada. La copia previa de D1 está cifrada y fuera de Git. No se han activado cobros live ni contratado Workers Paid.
