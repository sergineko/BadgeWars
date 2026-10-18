# Identificación social con D1 y Workers

Se usa OAuth directo con Google/GitHub. No configurar Supabase Auth ni modificar el Coolify compartido. Cada proveedor crea una cuenta distinta; no hay unión por email ni promesa de trasladar badges entre cuentas.

## Variables

`APP_URL`, `AUTH_COOKIE_SECRET` (32 caracteres o más aleatorios), `AUTH_PROVIDERS=google,github`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. Usar secretos de Worker para las claves. La configuración pública solo publica qué proveedores están disponibles y la site key de Turnstile.

Registrar exactamente estos callbacks, sustituyendo el origen:

- `https://badgewars.com/api/auth/callback/google`
- `https://DOMINIO/api/auth/callback/github`

Crear credenciales independientes de desarrollo para `http://127.0.0.1:8787` cuando el proveedor lo permita; no añadir comodines de redirect. Google requiere pantalla de consentimiento y alcance `openid profile`. GitHub usa `read:user`. No se piden emails, contactos ni repositorios.

Se utilizan PKCE S256, estado cifrado de diez minutos y un hash de estado de un solo uso en D1. Incluso si el intercambio falla, el estado queda consumido: reiniciar el acceso. Solo el perfil obtenido con la credencial del proveedor determina la identidad. El navegador no envía un userId de confianza.

La sesión es un token aleatorio; D1 almacena su hash y caducidad de treinta días. Cookie HttpOnly, SameSite=Lax y Secure en HTTPS. Logout verifica el origen y elimina la sesión. No se guardan access/refresh tokens sociales. Un enlace técnico de callback puede llevar parámetros, pero redirige a `/collection`, `/badge/...` o `/support/...` sin parámetros, con contexto cifrado de retorno.

Antes de publicar: probar ambos consentimientos, logout, estado repetido/inválido, callback ante caída de red y acceso propietario a colección y SVG. Revisar documentación y acuerdos de los proveedores si se cambian los datos solicitados.


Para correo/contraseña nativos, estado de las aplicaciones y configuración de dominio/Email Service, consultar [email-auth-and-domain.md](email-auth-and-domain.md). No usar las credenciales OAuth definitivas con un callback de loopback; mantener clientes de desarrollo separados.
