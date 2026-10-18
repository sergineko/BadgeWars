# Consulta del modelo de BadgeWars a Dodo Payments

Estado del **19 de octubre de 2026**: **precedente de Outbid comprobado; consulta preparada, todavía no enviada**. No existe respuesta ni aprobación de Dodo para BadgeWars. Los cobros siguen desactivados y la integración continúa siendo Polar Sandbox.

## Evidencia y valoración

Los [términos del dominio exacto outbid.lol](https://outbid.lol/terms) identifican a Dodo Payments como procesador del checkout. Describen posiciones públicas determinadas por importes pagados y mejoras pagando la diferencia. Es un precedente pertinente para solicitar evaluación de los niveles competitivos de BadgeWars; no acredita qué condiciones privadas tiene Outbid ni supone aprobación de nuestro producto.

Dodo documenta [créditos para compras únicas y consumo posterior](https://docs.dodopayments.com/features/credit-based-billing). Por tanto, los créditos de consumo propios no deben descartarse automáticamente como si toda recarga fuese una cuenta financiera. Su [política de aceptación](https://docs.dodopayments.com/miscellaneous/merchant-acceptance) requiere evaluar el producto completo y distingue servicios admitidos de categorías restringidas. Esa misma política indica **compliance@dodopayments.com** para consultas de elegibilidad.

**Valoración actual:** merece la pena priorizar una revisión concreta con Dodo. Deben clasificar expresamente BC, SVG alojados, niveles competitivos y apoyos de Trust Bag; no basta una respuesta genérica sobre packs de créditos. Si BC fuese el único impedimento, se puede preguntar por compras directas de badges/mejoras como alternativa. Esto sería un cambio real del producto que requeriría decisión del titular e implementación posterior.

| Aspecto | Outbid, según sus términos | BadgeWars que debe evaluar Dodo |
|---|---|---|
| Producto | Posición de una web/perfil en un ranking público | SVG personal dinámico por API, colección y ranking por familia |
| Pago | Checkout de posición/mejora | Recarga única BC; consumo posterior en nuestra aplicación |
| Competencia | Otro importe puede superar la posición | Niveles pagados; solo el primer intento atómico válido consume saldo |
| Apoyo y edición limitada | No se asume equivalencia | Trust Bag sin pagos al titular y diez Genesis de 1.000 BC |

## Canal y estado de entrega

| Dato | Estado |
|---|---|
| Contacto público | [Página oficial](https://dodopayments.com/contact): support@dodopayments.com y comunidad Discord. No se observó formulario público ni chat abierto sin sesión. |
| Revisión del modelo | compliance@dodopayments.com, indicado expresamente por su política. |
| Chat del panel | El [panel de Dodo](https://app.dodopayments.com/login) solicita iniciar sesión. No se ha creado cuenta ni aceptado contrato. No se ha comprobado aún la disponibilidad de un agente humano. |
| Remitente propuesto | Sergio Moreno García, SergioTech.es / BadgeWars; support@badgewars.com. |
| Consulta enviada | **No**. Texto preparado debajo; sin ticket, acuse ni decisión. |
| Respuesta que cerraría la duda | Decisión escrita sobre el modelo completo y condiciones/cambios exigidos, o instrucciones concretas para una revisión formal. |
| Otros proveedores | [Freemius](freemius-model-review.md): consulta recibida, respuesta pendiente. [Polar](polar-model-review.md): onboarding rechazó el caso. |

El alias support@badgewars.com recibe mediante Cloudflare Email Routing; esto no demuestra que exista un buzón de salida. No se deben simular envíos mediante APIs privadas del soporte ni presentar una consulta preparada como enviada. Una respuesta automática o de un chatbot tampoco equivale a aceptación comercial.

## Consulta preparada en inglés

Destinatario: **compliance@dodopayments.com**, con copia a **support@dodopayments.com** si se envía por correo. Para el chat, pedir que lo derive al equipo que evalúe elegibilidad.

La siguiente es nuestra propuesta de consulta, no una respuesta de Dodo.

```text
Subject: BadgeWars eligibility review — dynamic SVG/API badges, prepaid credits and paid rankings; Outbid precedent

Hello Dodo Payments team,

I am Sergio Moreno Garcia, operating BadgeWars through SergioTech.es in Spain. Our English/Spanish website is https://badgewars.com. It is operational, but real payments remain disabled pending provider review. Could your eligibility/compliance team assess the complete model below?

Relevant precedent: https://outbid.lol/terms publicly identifies Dodo Payments as its checkout provider for a paid public ranking. We are not assuming that another merchant's arrangement approves our business. It suggests that paid competitive placement may be supportable, so we would like a specific assessment rather than inferring a blanket prohibition. We also read your Credit-Based Billing documentation for one-time products.

Product delivered:
Customers acquire personal dynamic SVG badges backed by our hosted software, a private collection and a stable public endpoint/API. They can obtain their own HTML/Markdown embed code and display their badge on any website, profile or repository README they choose. The same URL updates the SVG's level, position or support points as its state changes, subject to CDN/third-party caching. It is an ongoing software-powered badge service, not just a static image download.

Proposed checkout and consumption:
Dodo would process one-time BadgeCredit (BC) packs, starting at 5 BC. EUR 1 or USD 1 of base price buys 1 BC, with applicable taxes shown at checkout. A verified payment credits a single balance in our Cloudflare D1 database exactly once. Later badge purchases/upgrades consume BC in our application. BC have no programmed expiry and cannot be transferred between users, withdrawn as cash, resold or spent at outside merchants. They do not generate returns. All payments are revenue for BadgeWars; badge holders receive no money or spendable credits from others.

Actual badge mechanics:
- Apex Flex starts at 1 BC, Don't Click This / Bait at 5 BC and Build Funded at 50 BC. A new leading badge level must exceed the current leader by at least 1 BC. An upgrade costs only the difference from that buyer's own previous level. The buyer receives or updates their personal badge; another user can subsequently overtake its ranking. The badge remains available with its current rank, without a commercial refund for being overtaken. For simultaneous conflicting purchases, only the first valid atomic transaction consumes BC; the unsuccessful attempt is not charged. Build Funded uses sponsorship-style wording but does not transfer funds to a repository owner.
- Trust Bag activation costs 20 BC. Other users can spend BC to add support points to the holder's badge, at 1 BC per point. The SVG displays its current support/reliability rank. This is disclosed as paid community support, not independent certification, verified code quality or an organic review. The holder receives points only, never funds or spendable BC. The complete contributor list is private, with at most five aliases optionally made public.
- Genesis has exactly ten numbered editions at 1,000 BC each, at most one per account, with no transfers or resale.

There are no cash prizes, random rewards, user payouts, investments, cryptocurrency or NFTs. Our requested commercial refund policy covers a paid top-up that was not correctly credited and has not been followed by BC consumption. Mandatory consumer rights and the MoR's refund/chargeback decisions remain applicable; reversals must be reconciled even after consumption.

Rules and operator information:
https://badgewars.com/terms
https://badgewars.com/legal

Please confirm:
1. Can Dodo support this complete dynamic SVG/API product, including BC packs, competitive paid levels, Build Funded, Trust Bag and limited Genesis editions?
2. Would these non-transferable own-service consumption credits fall within supported credit-based billing, rather than a prohibited financial wallet/stored-value product? We need your classification, not a conclusion based only on the name of the pack.
3. If any feature is unsupported, which one and why? Would direct per-badge/per-upgrade checkout instead of prepaid BC resolve the issue, or would the underlying feature still be unsupported?
4. What onboarding, genuine product changes, limits or refund terms would you require? Please provide a written decision/reference, or tell us the formal review steps, before we enable live payments.

We can provide a walkthrough or demo access for review. We are seeking approval for the actual service, not just a generic credit-pack listing. Please reply to support@badgewars.com.

Thank you,
Sergio Moreno Garcia
SergioTech.es / BadgeWars
support@badgewars.com
```

## Si Dodo acepta el modelo

La aceptación no activa por sí sola los cobros. Habrá que completar alta/verificación y adaptar checkout, firma/eventos de webhook, conciliación, reembolsos, portal, facturas, pruebas y textos ES/EN. La integración actual importa funciones y referencias de Polar; cambiar solo el nombre del proveedor o una clave no basta. No usar una referencia de Dodo como `POLAR_LIVE_APPROVAL_REFERENCE`.
