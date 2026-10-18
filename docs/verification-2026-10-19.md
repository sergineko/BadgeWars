# Verificación del 19 de octubre de 2026

## Despliegue

- Worker `badgewars` publicado en Workers Free con Assets, D1 dedicada UE, KV público, cron cada cinco minutos y secretos de sesión/OAuth. No se contrataron servicios de pago.
- Nueve migraciones remotas aplicadas. Se excluyeron fixtures, documentos y datos de QA. Las dos sesiones reales de prueba crean cuentas independientes con cero BC.
- `badgewars.com` y `www.badgewars.com` conectados al Worker. Parking sustituido con autorización y valores anteriores conservados localmente. Redirección www → HTTPS raíz 308 comprobada para HTTP/HTTPS, rutas y parámetros técnicos. Certificado válido, HTTPS obligatorio activado y correo conservado.
- Cron publicó las cinco familias. `/api/arena`: 200, `demo:false`, inicialmente sin badges adquiridos. Los cinco endpoints SVG: 200, `image/svg+xml`, CORS `*`; TTL 15 segundos para Trust Bag y 300 para los otros. No implica prueba de todos los puntos de presencia ni de cachés de terceros.
- Google: perfil de la cuenta profesional autorizado por el titular, retorno HTTPS, colección y cierre de sesión comprobados. GitHub: perfil de sergineko autorizado, retorno y colección comprobados. Las pruebas se ejecutan secuencialmente: iniciar otro OAuth en el mismo navegador sustituye la cookie del intento previo.
- Google sigue en Testing; acceso general pendiente. Email Routing recibió la verificación de la cuenta profesional confirmada por el titular; el correo de registro/recuperación de la plataforma todavía no se envía en Internet.

## Flex y clasificaciones

- Flex comienza en 1 BC. Migración 0009 cambia solo la base y marca la proyección pendiente; conserva niveles, badges y saldos existentes. El siguiente mínimo sigue siendo líder + 1 y renovar paga solo la diferencia.
- Rankings separados de Flex, Bait, Build Funded y Trust Bag, con filtros privados en sesión por badge y rutas limpias. Genesis mantiene su propia tabla de propietarios por edición, sin clasificación artificial por precio fijo.
- Revisión visual ES/EN, búsqueda de un alias conservando #2 en Flex y #1 en Build Funded, separación de filtros y tabla de Genesis. Inicio conserva Hall of Flex como resumen.
- Menú sticky comprobado con desplazamiento superior a 1.500 px y borde superior en 0. Altura observada para que los destinos de sección queden debajo; transiciones de página disponibles en el navegador de prueba y desactivadas con preferencia de movimiento reducido.
- Condiciones r7 ES/EN explican mínimo de Flex y prioridad de la primera operación confirmada atómicamente en D1. Los documentos de condiciones aceptados anteriormente permanecen conservados por versión.

## Puja coincidente

55 pruebas automáticas correctas. Prueba adicional sobre HTTP con workerd y D1 nativos **locales**, en almacenamiento aislado:

1. Dos cuentas ficticias con 5 BC reciben simultáneamente un presupuesto de 1 BC para Flex.
2. Se envían dos compras de ese nivel a la vez: una respuesta 200 y una 409 `price_changed`.
3. Ganador: un badge y saldo 4. Segundo: ningún badge y saldo 5. No hay devolución monetaria ni abono artificial.
4. Repetir la referencia ganadora conserva saldo 4 y el mismo identificador. Nuevo mínimo para el segundo: 2 BC.

Evidencia local ignorada: `artifacts/concurrent-bids-native.json`. La prueba no modifica saldos de usuarios remotos ni garantiza un orden basado en la hora del dispositivo: decide la primera confirmación atómica de D1.

## Pendientes para apertura comercial

Turnstile de producción; publicación general de Google; Workers Paid y Email Sending con entrega real antes de activar correo/contraseña; aceptación expresa de Polar del modelo completo, recursos/secretos de producción y webhook permanente; matriz final de pagos/reversiones, alertas, recuperación y revisión legal/fiscal del titular. El binding de email desplegado no prueba que la salida de correo esté habilitada. No se ha enviado ninguna solicitud comercial al proveedor.
