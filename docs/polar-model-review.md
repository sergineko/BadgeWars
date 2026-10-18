# Revisión del modelo de BadgeWars en Polar

Estado del **19 de octubre de 2026**: **modelo rechazado por la validación del onboarding de producción; cobros reales bloqueados**. No hay aprobación comercial, organización habilitada para este producto ni referencia de aceptación que pueda incorporarse al Worker.

## Resultado y alcance

| Paso | Resultado comprobado | Consecuencia |
|---|---|---|
| Consulta mediante Support en la organización Sandbox | El formulario indicó que no preaprueba cuentas ni revisa casos de uso por soporte y remitió al onboarding. No apareció confirmación de entrega ni número de ticket. | No registrar la consulta como email enviado, expediente abierto o aceptación del negocio. |
| Acceso a producción | El titular inició sesión en polar.sh y autorizó preparar la configuración comercial. | Se continuó el alta, sin conectar una cuenta bancaria ni contratar un plan. |
| Datos de producto | Categoría Other, precio One-time purchase, URL https://badgewars.com y soporte support@badgewars.com; descripción íntegra debajo, 2.726 caracteres. | Se declararon expresamente saldo prepago, rankings pagados, aportaciones y ausencia de pagos a usuarios. |
| Evaluación del alta | Al presentar los datos, Polar mostró **“Use case not supported”**. Señaló rankings pagados y Trust Bag como prueba social/reputación comprada, Build Funded como patrocinio y BC como saldo prepago almacenado. Indicó que esas partes no son aceptables para pagos reales. | El formulario permanece en Product Details con Review again. No se ha completado Launch Dashboard ni se dispone de aprobación para ninguna combinación parcial del modelo. |
| Estado de la aplicación | Configuración comercial de producción sin habilitar; Sandbox separado. | No rellenar POLAR_LIVE_APPROVAL_REFERENCE con este rechazo ni activar cobros reales. |

Esta es una respuesta visible del proceso de alta, **no una carta de aprobación ni un dictamen individual firmado de un equipo humano**. No se ha confirmado entrega de un email ni respuesta a support@badgewars.com. La decisión debe tratarse como negativa mientras no exista una aceptación explícita posterior que cubra el modelo completo.

La [AUP de Polar](https://polar.sh/legal/acceptable-use-policy), consultada el 19 de octubre de 2026, enumera restricciones relacionadas con patrocinios/publicidad/donaciones, prueba social falsa o inflación de reseñas y saldos para clientes. La [documentación de soporte](https://polar.sh/docs/support) distingue el contacto de soporte del proceso de revisión de cuentas. La respuesta concreta del onboarding confirma que esos aspectos impiden este alta.

Evidencias locales excluidas de Git: artifacts/polar-model-review-route.png y artifacts/polar-model-not-supported-2026-10-19.png. No incluyen credenciales ni se publican datos de verificación del titular.

## Siguiente decisión necesaria

Mantener los cobros desactivados. Para continuar con Polar haría falta una revisión expresa posterior que realmente admita las mecánicas declaradas, o modificar el producto de forma sustancial y someter el modelo nuevo a revisión. La otra vía es seleccionar un proveedor que admita el modelo actual. No recategorizar ni ocultar BC, rankings, Build Funded o Trust Bag para superar el filtro. No se ha solicitado ni contratado otro proveedor.

El resto de tareas de lanzamiento se conserva en la [tabla de pendientes](review-and-launch.md#tabla-de-pendientes). Los avances de Google, Turnstile, correo y operación pueden continuar sin habilitar pagos.

## Descripción presentada en el onboarding

El siguiente texto es la descripción original de BadgeWars enviada para evaluación del producto, no una respuesta ni unas condiciones redactadas por Polar.

```text
BadgeWars (https://badgewars.com), operated by SergioTech.es in Spain, sells dynamic SVG badges and paid ranking visibility. Please review the complete model against your AUP before live payments; we are not treating Sandbox success as approval.

Users make one-time prepaid top-ups: EUR 1 or USD 1 of base price buys 1 BadgeCredit (BC), taxes shown in checkout; minimum top-up 5 BC. There is one shared internal balance, no FX service and no programmed expiry. BC cannot be transferred, withdrawn, resold or spent outside BadgeWars. A verified Polar order credits the wallet once; subsequent badge actions consume BC. There are no user payouts, revenue shares, cash prizes, random rewards, NFTs or investments. All revenue goes to the platform operator.

Five badge families:
- The Apex Flex: competitive paid level starting at 1 BC. New leader must exceed current level by at least 1 BC; renewal charges only the difference from the user's own previous level. Users can be overtaken; no guaranteed ranking duration, traffic or income. Simultaneous conflicting bids do not debit the loser.
- Don't Click This / Bait: similar paid competition starting at 5 BC, with playful text naming the paying user. Owner-embedded badge only; no unauthorized changes to third-party sites.
- Build Funded: starts at 50 BC and shows a paying supporter's name in a sponsorship-style badge for a profile/repository. The repository owner receives no funds: proceeds remain with BadgeWars.
- Trust Bag: activation 20 BC. Other users spend BC to add points (1 BC = 1 point) to the recipient's public support/reliability ranking. Rank appears on the badge; full supporter list is private, with up to five aliases optionally displayed. This is bought community support/social visibility, not independent quality verification or professional certification. The recipient receives neither money nor spendable credits.
- Genesis: exactly 10 numbered non-transferable editions, 1,000 BC each, maximum one per account; no NFT, resale or investment rights.

Badges have stable public SVG URLs for embedding in websites/READMEs; code generation is private to the owner. Terms/legal: https://badgewars.com/terms and /legal, ES/EN. No voluntary cash redemption, except review of a paid top-up not credited and not followed by usage; mandatory consumer rights and Polar's refund/chargeback decisions remain applicable.

Your AUP restricts donations/sponsorship/advertising, paid/fake social proof and customer balances. Please explicitly assess prepaid BC, paid rankings, Build Funded and Trust Bag. If any part is disallowed, identify it; live payments will stay disabled until resolved. Please provide a written decision/reference to support@badgewars.com.
```
