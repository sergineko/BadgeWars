# Cambio a Cloudflare D1

La conexión PostgreSQL/Hyperdrive y las dependencias `pg`/PGlite se han retirado del código activo. Autenticación, monedero e inventario viven en una D1 exclusiva de BadgeWars con tablas `bw_*`, para no mezclar otros proyectos. No se ha tocado la infraestructura compartida anterior.

## Base nueva y vacía

1. Crear D1 y KV dedicados en la cuenta Cloudflare destino; anotar sus IDs en `wrangler.jsonc`.
2. Copiar `.dev.vars.example` a `.dev.vars` para desarrollo y configurar secretos independientes para sandbox.
3. `pnpm db:migrate:local` aplica `0001_d1.sql` a `0008_email_auth.sql` a la instancia local. Se ha verificado también el motor de Wrangler/workerd, no solo un emulador de SQL en las pruebas.
4. Aplicar al destino remoto durante el despliegue autorizado con `pnpm db:migrate:remote`. Comprobar versión y filas antes de cambiar el dominio.
5. Ejecutar la tarea programada tras configurar bindings para publicar las cinco familias iniciales en KV. Hasta entonces las vistas públicas devuelven `projection_pending`/503; no se sustituyen por datos demo.
6. Probar OAuth, compra real de prueba, emails/portal de Polar, confirmación, gasto, reembolso y recuperación. Activar producción solo con aceptación del proveedor y configuración legal/documental validada.

## Si existen datos reales anteriores

No se presupone que los datos de demo sean compras ni se convierten automáticamente importes antiguos en saldo nuevo. Antes de cambiar tráfico, exportar y conciliar usuarios, compras, devoluciones, fichas estables, ediciones emitidas, apoyos y consentimientos. Congelar operaciones durante el corte y conservar los registros fiscales/Stripe anteriores.

Los identificadores OAuth del proveedor y los IDs internos del Auth anterior no son intercambiables. Planificar y probar una vinculación verificada; no unir cuentas por el email, alias o un userId enviado por el navegador. Conservar IDs estables del inventario y cualquier redirección de SVG necesaria; no reasignar un número de Genesis.

Importar solo datos reconciliados en un entorno de ensayo, comprobar totales y duplicados y emitir asientos de apertura trazables. Los nuevos términos no se deben atribuir retroactivamente a compras antiguas. Probar antes de desviar tráfico y disponer de una copia restaurable. No hay un importador remoto automático ejecutado en esta revisión.

Las fuentes históricas y migraciones 001–005 anteriores se conservan en `legacy/postgresql/` como texto/referencia. No las ejecutar contra SQLite ni usarlas para configurar Supabase compartido.
