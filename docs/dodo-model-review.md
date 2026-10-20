# Revisión del modelo de BadgeWars por Dodo Payments

Estado consultado el **20 de octubre de 2026**: **verificación completa y aprobada**. El titular confirmó el resultado y el panel muestra producto, identidad y cuenta bancaria aprobados. Los cobros públicos siguen deshabilitados por decisión del titular; no se confunde la aprobación de Dodo con el alta fiscal ni con el lanzamiento. [Preparación y activación](dodo-live-activation.md) · [plan A–E](review-and-launch.md).

## Presentación comprobada

| Dato | Estado |
|---|---|
| Canal | Formulario de verificación de la cuenta Dodo, https://app.dodopayments.com/verification. |
| Producto | BadgeWars / SergioTech.es, https://badgewars.com, categoría Software SaaS/IA. |
| Entrega declarada | Acceso instantáneo, sin intervención humana en la prestación principal; compras únicas, no suscripción. |
| Integración | API/SDK/Adapters. SDK Dodo, checkout en servidor, firma, inbox, consulta autoritativa, D1 atómica y recuperación. |
| Etapa / proveedor actual | Beta; ningún proveedor procesa cobros live. Dodo es la única integración actual. |
| Revisión de contenido | Se corrigieron y guardaron las dos descripciones del producto y flujo técnico, incluidas las cinco familias, precios BC, posiciones pagadas, apoyos, ausencia de pagos a titulares y pruebas externas pendientes. |
| URLs | Web normalizada a badgewars.com. Se conservó el perfil profesional que ya había facilitado el titular. |
| Último envío | El titular confirmó personalmente el destino bancario y pulsó el envío final. Después se comprobó el estado de revisión en el panel. |
| Resultado visible | «La verificación está completa». Información del producto, información personal y verificación bancaria: **Aprobado**. |
| Decisión / referencia | Aprobación observada en el panel de BadgeWars el 20/10/2026 y confirmada por el titular. No se inventa un número de expediente ni una respuesta individual de Compliance. |
| Correo o chat de Compliance | No se envió una consulta adicional por correo ni se obtuvo respuesta humana por chat. La presentación efectiva fue el formulario de verificación. |

Evidencia local excluida de Git: `artifacts/dodo-verification-submitted-2026-10-19.png`. No publicar IBAN, documentos de identidad, teléfono, capturas bancarias ni credenciales. La ficha comercial y técnica incluida debajo no contiene esos datos.

## Precedente y alcance de la consulta

Los [términos del dominio exacto outbid.lol](https://outbid.lol/terms) identifican a Dodo como procesador de su ranking pagado. Dodo también documenta [créditos para compras únicas y consumo posterior](https://docs.dodopayments.com/features/credit-based-billing). Estas referencias justificaron priorizar la revisión; no acreditan condiciones privadas de otro comercio ni una autorización para BadgeWars.

La [política de aceptación](https://docs.dodopayments.com/miscellaneous/merchant-acceptance) evalúa el servicio completo e indica compliance@dodopayments.com para dudas de elegibilidad. No se ocultaron funciones ni se presentó Trust Bag como una certificación de seguridad o un mero coste criptográfico contra bots. La ficha describe los niveles y apoyos pagados, el SVG/API y las recargas sin canje monetario.

La propuesta inicial de email, preparada antes de crear la cuenta, **no se envió**. Fue sustituida por las descripciones de verificación que se guardaron y cuyo expediente se envió después. [Freemius](freemius-model-review.md) sigue con una consulta recibida sin respuesta comercial registrada.

## Descripción del producto guardada

Este texto es la declaración de BadgeWars, no una respuesta o aprobación de Dodo.

```text
BadgeWars is a hosted software service (SaaS) for gamification and API-based profile customization, operated through SergioTech.es in Spain. Customers buy non-transferable BadgeCredits (BC) to activate personal dynamic SVG badges, upgrade competitive badge levels, and use paid community-support interactions. Owners get a private collection and a stable public SVG endpoint/API with HTML/Markdown embed code for any website or README. The same URL reflects the current badge level, rank or support points, subject to CDN/third-party caching. Rankings are explicitly paid levels or paid community support, not independent reviews, professional certifications or guaranteed code quality. BC can only be consumed by BadgeWars software: no monetary value outside it, cash redemption, withdrawals, resale, user-to-user credit transfers or user payouts. There are no cash prizes, random rewards, investments, crypto or NFTs. Please assess all five badge families and their consumption rules described in the delivery flow.
```

## Flujo comercial y técnico guardado

```text
**Historical description submitted for review; the pricing paragraph below records that submission. Current pricing since 21 October 2026 uses one EUR reference product with Adaptive Currency, as documented in [the FX report](dodo-fx-verification.md). It has not been represented as a separate new approval.**

Customers sign in through Google or GitHub. Email/password is implemented locally but disabled in production pending CPU plan and transactional-email activation. Dodo will process one-time BC purchases: minimum 5 BC; EUR 1 or USD 1 base price buys 1 BC, with tax and final total displayed before payment. Both currencies feed one internal balance with no programmed expiry. We use two allowlisted fixed-price products (EUR/USD), each representing one BC, with quantity selected server-side. Currency changes, discounts and editable prices are disabled.

After a signed payment.succeeded notification, our Cloudflare Worker re-fetches the authoritative payment using the Dodo SDK. It checks business, environment, metadata/account reference, product, quantity, currency, pre-tax amount and checkout session before crediting BC exactly once in Cloudflare D1. A browser return never credits the account. Customers separately confirm the badge action and its BC cost. Atomic D1 validation/debit prevents double spending and conflicting claims. A durable webhook inbox and scheduled reconciliation handle retries and missed events. Refunds/disputes are reconciled, accounts can be frozen for review, and negative balances cannot be spent. Money is never paid out to a badge holder.

Badge rules:
- Apex Flex starts each independent season at 1 BC; Don't Click This / Bait starts at 5 BC. A new leading level must exceed the leader by at least 1 BC; renewing costs the difference from that account's previous level (within the same season for Apex Flex). Only the first valid atomic conflicting transaction spends BC. Apex Flex season 1 is open without an announced deadline. Closing locks final ranks; each acquired season badge and URL remain in its holder's collection, with a separate design and fresh leaderboard for any new season.
- Build Funded is a one-time personal developer profile badge for a fixed 50 BC, with unlimited supply and one per account. It cannot be taken by another user, renewed or transferred. Its public directory lists holders and acquisition dates only. It is self-declared customization, not proof of qualifications and not a payout to a repository or creator.
- Trust Bag activation costs 20 BC and adds no points. Other accounts can consume BC for paid support points (1 BC = 1 point), increasing the holder's support rank and updating the SVG. The holder receives points only, not funds or spendable credits. This is paid community support, not independent certification. The full contributor list is private; at most five aliases can be optionally public. Charging BC is not presented as identity verification or a guarantee against bots; access/rate/abuse controls are separate.
- Genesis: ten numbered editions at 1,000 BC each, one per account, no transfers/resale.

Owners generate their own embed code in their authenticated collection. SVGs are public for embedding; full contributor/payment records remain private. KV/HTTP caches serve public rankings and SVGs, so updates are not guaranteed to refresh instantly on every external site.

No cashback or cash redemption. Commercial refunds are limited to a charged top-up not correctly credited, subject to review and no subsequent BC use; mandatory consumer rights and Dodo's refund/chargeback decisions remain applicable. Policies ES/EN: https://badgewars.com/terms , /refunds , /privacy , /legal and /cookies, readable without JavaScript. Dodo is identified as the intended MoR and invoice issuer; BadgeWars operating confirmations are not duplicate tax invoices.

Integration is implemented with the official Dodo SDK and tested locally against API-shaped fixtures, including verified signatures, duplicate/out-of-order events, refunds and disputes. Live payments remain disabled. Dodo product/key/webhook setup and real test-mode end-to-end payments are still to be completed before commercial activation. We have no live sales or current production payment provider.
```

## Siguiente paso

La decisión favorable ya se ha recibido. Preparar catálogo, clave y webhook Live manteniendo las recargas bloqueadas; habilitarlas únicamente cuando el titular autorice el lanzamiento. [Estado y secuencia](dodo-live-activation.md). La referencia de aprobación procede del panel de Dodo, no de otro proveedor.

## Verificación técnica posterior al envío

Compras Dodo test EUR/USD, webhooks, saldo, renovación de badge, SVG, portal, facturas y recepción de emails comprobados después de presentar la solicitud. Ver [informe de test](dodo-test-verification.md). No modifica la descripción ya enviada ni implica aprobación comercial.
