# Consulta del modelo de BadgeWars a Freemius

Estado del **19 de octubre de 2026**: **consulta enviada y recepción confirmada por el formulario; respuesta comercial pendiente**. Esta confirmación acredita la presentación de la consulta, no la aceptación del negocio ni una autorización para cobrar.

## Presentación y alcance

| Dato | Estado comprobado |
|---|---|
| Canal | Formulario Contact de la web oficial de Freemius; tres pasos, incrustado desde https://freemius.com/eforms/contact-us/8/. |
| Producto declarado | SaaS y Widget. Badge personal SVG generado por software alojado, endpoint/API público y colección privada. |
| Ventas actuales | Not yet. BadgeWars está publicado, pero no ha abierto ventas reales. |
| Remitente y respuesta | Sergio Moreno García, SergioTech.es / BadgeWars; support@badgewars.com. |
| Descripción enviada | Texto íntegro de 4.111 caracteres incluido debajo. Explica el SVG dinámico, URL estable, inserción externa y límites de caché; saldo BC, cinco familias, niveles pagados, apoyos y ausencia de pagos a usuarios. |
| Confirmación visible | El formulario mostró **“Your request has been successfully submitted.”** e indicó que su equipo revisará la consulta y responderá. |
| Referencia de expediente | No se mostró número de ticket ni referencia individual. No inventar una referencia de aprobación. |
| Respuesta comercial | Pendiente. No se ha confirmado recepción de email ni aceptación de Freemius. |
| Cambios operativos | No se creó cuenta de vendedor, ni se aceptó contrato, conectó banco o integró Freemius. Los cobros públicos siguen desactivados. |

Evidencia local excluida de Git: artifacts/freemius-model-review-submitted-2026-10-19.png. Solo se han enviado los datos profesionales públicos y la descripción del producto, sin claves, NIF, domicilio, teléfono, documentos de identidad ni registros de compradores.

El beneficio solicitado por el titular se explica al principio: el comprador recibe un **badge SVG personal servido por endpoint/API**, que puede publicar en cualquier web, perfil o README, con actualizaciones automáticas de estado/ranking sin cambiar su URL. Se explican también las cachés: no se promete refresco global instantáneo.

## Qué debe resolver la respuesta

- Si aceptan el servicio alojado de SVG personal y API, además de recargas de BC mediante compras únicas para consumos posteriores.
- Si la aceptación cubre los niveles competitivos pagados de Apex Flex, Bait y Build Funded, aun cuando otro usuario supere después la posición.
- Si admiten Trust Bag con apoyos comprados por terceros, puntos/ranking visibles y ninguna entrega de dinero o saldo al titular del badge.
- Si admiten las diez ediciones Genesis de 1.000 BC y la política de reembolsos comerciales descrita, preservando derechos obligatorios y decisiones del MoR.
- Si requieren cambios reales del producto, límites o documentación adicional, y qué referencia acredita la decisión.

Mantener desactivados los cobros hasta una aceptación expresa del modelo completo y la configuración/pruebas del proveedor elegido. La aprobación general de una cuenta o una recarga de prueba no sustituye esa aceptación. No utilizar una futura referencia de Freemius como POLAR_LIVE_APPROVAL_REFERENCE: si se elige Freemius, habrá que adaptar integración, controles de activación y documentos al nuevo vendedor.

La [guía de créditos de Freemius](https://freemius.com/help/documentation/saas/usage-based-billing-credits/) describe recargas de compra única y consumo en la aplicación. Su [AUP](https://freemius.com/terms/acceptable-use/) mantiene requisitos sobre el producto completo y reglas de los procesadores. Estas fuentes justifican solicitar evaluación; no constituyen aprobación de BadgeWars. El [resultado previo de Polar](polar-model-review.md) permanece registrado por separado y la [tabla de pendientes](review-and-launch.md#tabla-de-pendientes) conserva el bloqueo de cobros.

## Texto íntegro enviado

La siguiente es la consulta de BadgeWars, no una respuesta ni unas condiciones redactadas por Freemius.

```text
Pre-launch eligibility review: BadgeWars — personal dynamic SVG badges with an API-backed hosted service

Hello Freemius team,

I am Sergio Moreno Garcia, operating BadgeWars through SergioTech.es in Spain. The website is https://badgewars.com (English/Spanish). It is live, but commercial payments remain disabled. I would like your written assessment of whether Freemius can support the complete product before we integrate.

What customers receive:
A personal SVG badge backed by our hosted software, a private collection/dashboard, and a stable public SVG endpoint/API. The owner can copy their own HTML/Markdown embed code and display the badge on any website, profile or repository README they choose. Our API generates the SVG from the current badge state and updates its owner, level, ranking or support points as that state changes. The same embed URL continues to work after an upgrade or rank change; it is an ongoing dynamic badge service, not merely a static image download. Updates are subject to HTTP/CDN and third-party caching, so we do not promise zero-delay refresh everywhere. Badges and rankings have independent families.

How customers pay:
We read your guide on usage-based billing with prepaid credits. We would sell one-time BadgeCredit (BC) top-ups, starting at 5 BC: EUR 1 or USD 1 of base price buys 1 BC, with taxes shown at checkout. One shared internal balance is held in our Cloudflare D1 database. A verified paid purchase credits it exactly once; later badge purchases/upgrades consume BC in our application. There is no programmed expiry, transfer between accounts, cash withdrawal, resale or use with outside merchants. All payments are revenue for BadgeWars; badge holders receive neither money nor spendable BC from other users.

Badge mechanics that we also need you to assess:
- The Apex Flex starts at 1 BC; Don't Click This / Bait starts at 5 BC; Build Funded starts at 50 BC. These are competitive paid badge levels. A new leading level must exceed the current leader by at least 1 BC. Upgrading costs the difference from the buyer's own previous level. The buyer receives/updates their personal badge and can later be overtaken; their badge remains with its current lower rank, without a refund for losing position. Simultaneous conflicting purchases are rejected without debiting the unsuccessful user. Bait uses playful display text. Build Funded uses sponsorship-style wording identifying the paying supporter, but does not pay any money to a repository owner.
- Trust Bag activation costs 20 BC. Other users can spend BC to add support points to a holder's badge (1 BC = 1 point). The SVG shows the current support/reliability rank. This is expressly paid community support, not independent professional certification or verified code quality. The complete contributor list is private; the holder may optionally show up to five aliases. The recipient receives points only, not funds or spendable credits.
- Genesis consists of exactly 10 numbered editions at 1,000 BC each, at most one per account, without transfers or resale.

There are no cash prizes, random rewards, user payouts, investments, cryptocurrency or NFTs. Commercial refunds are limited to review of a charged top-up that was not delivered and has not been followed by BC usage; mandatory consumer rights and the MoR's refund/chargeback decisions still apply and must be reconciled.

Rules: https://badgewars.com/terms
Legal/operator details: https://badgewars.com/legal

Can Freemius expressly support this entire model: the hosted dynamic SVG/API product, prepaid BC, competitive paid badge levels, Build Funded, Trust Bag support rankings and the limited Genesis editions? Please identify any unsupported element or required genuine product change, and route this to the appropriate product/compliance reviewer if needed. We are seeking approval for the actual functionality, not just the name of a credit pack. Please provide a written decision/reference to support@badgewars.com before we enable real payments.

Thank you,
Sergio Moreno Garcia
SergioTech.es / BadgeWars
support@badgewars.com
```
