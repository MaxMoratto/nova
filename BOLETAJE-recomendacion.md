# Infraestructura de venta de boletos — Nova Strike Series

Evento grande (1,500+), CDMX. Objetivo: **compra segura** + **boletos válidos y a prueba de reventa en la puerta**, con pago por tarjeta, OXXO, transferencia (SPEI/CoDi) y boleto en wallet/PDF.

---

## Recomendación corta

**No construyas el cobro tú mismo.** Para 1,500+ personas, hacer el checkout a mano te obliga a cargar con cumplimiento PCI (manejo seguro de tarjetas), contracargos, fraude y validación en puerta. Usa una **plataforma de boletaje lista** que ya resuelve todo eso, y deja tu página `nova` como la cara de marketing que manda al botón **"Comprar boletos"**.

Esquema recomendado (**híbrido**):

```
Tu página nova (imagen, cartelera, hype)
        │  botón "COMPRAR BOLETOS"
        ▼
Plataforma de boletaje  →  cobra (tarjeta/OXXO/SPEI)
        │                  →  emite boleto QR (email + Apple/Google Wallet + PDF)
        ▼
App lectora en la puerta  →  escanea QR, lo marca como usado (anti-duplicado)
```

Ventaja clave de seguridad: **tú nunca tocas los datos de tarjeta** → menos riesgo legal y técnico, y la plataforma absorbe el fraude.

---

## Finalistas para evento grande en México

| Plataforma | Por qué encaja | Pago tarjeta | OXXO | Transfer/SPEI | Wallet/QR | Validación en puerta |
|---|---|---|---|---|---|---|
| **Passline** *(top para masivos)* | Diseñada para eventos grandes: app lectora QR, cashless, tótems, antifraude, integración con POS | ✅ | ✅ | ✅ | ✅ QR (app propia) | ✅ App "Lector Passline QR" |
| **Boletia** *(muy mexicana, fácil)* | Estándar en México, onboarding rápido, OXXO nativo | ✅ | ✅ ($12–16 MXN/op.) | ✅ | ✅ QR | ✅ App de validación |
| **Ticketmaster / Superboletos** *(liga mayor)* | Máximo antireventa (boleto nominativo + tarjeta/ID en acceso), Apple/Google Wallet | ✅ | ✅ OXXO Pay | ✅ | ✅ Wallet nativo | ✅ Torniquetes/lectores |
| **Ticketopolis** | OXXO, transferencia y hasta cripto; gafetes QR personalizados con tu marca | ✅ | ✅ | ✅ | ✅ QR | ✅ |

> **Mi sugerencia:** empieza evaluando **Passline** (porque está pensado para aforos altos y trae control de acceso serio) y **Boletia** (porque es la más sencilla de arrancar en México). Si quieres el antireventa más estricto y no te importa firmar contrato/comisiones mayores, **Ticketmaster/Superboletos** es la liga mayor.

> **Sobre CoDi:** casi todas soportan **SPEI/transferencia** (el primo práctico de CoDi). CoDi *como tal* (QR de Banxico) es poco común en plataformas de boletaje; si lo necesitas sí o sí, confírmalo directo con la plataforma antes de decidir.

---

## "Compra segura" — qué la hace segura

1. **PCI-DSS lo lleva la plataforma:** el cobro corre en su servidor, no en tu página. Tú no guardas ni ves números de tarjeta.
2. **HTTPS de punta a punta:** Vercel ya te da certificado SSL automático en tu dominio.
3. **3-D Secure (verificación del banco):** las plataformas serias piden confirmación al banco del comprador → menos contracargos.
4. **Antifraude del proveedor:** detección de tarjetas robadas y compras sospechosas incluida.

---

## "Evento seguro" — antireventa y control en puerta

- **Boleto nominativo:** lleva el nombre del comprador. En accesos de alto valor (VIP), pides **tarjeta de compra + identificación**.
- **QR de un solo uso:** la app lectora marca el QR como "usado" en el primer escaneo → un screenshot reenviado no entra dos veces.
- **App lectora offline:** que funcione sin internet en la puerta (las redes se saturan en eventos grandes).
- **Varios puntos de acceso:** varios celulares/lectores sincronizados para que no se duplique un boleto entre puertas.
- **Límite de compra por persona:** reduce acaparamiento para reventa.

---

## Cómo se conecta con tu página `nova`

Tu sitio actual ya tiene botones **"⚡ COMPRAR BOLETOS"**. Solo hay que apuntarlos a la plataforma:

- **Opción A (enlace):** el botón abre la página del evento en la plataforma (ej. `passline.com/eventos/nova-strike-47`). Es lo más simple y robusto.
- **Opción B (embed):** insertas el widget/checkout de la plataforma dentro de tu página con un `<iframe>` o su script. Se ve más integrado, pero depende de que la plataforma lo permita.

En ambos casos el dinero y los boletos los maneja la plataforma; tu página solo enamora y manda al checkout.

---

## Costos a tener en cuenta (confírmalos al día con cada proveedor)

- **Comisión por boleto:** normalmente un % del precio + un fijo por boleto. Decides si la absorbes tú o se la sumas al comprador ("service fee").
- **Comisión OXXO:** ~$12–16 MXN por operación, además de la comisión de la plataforma.
- **Liquidación:** pregunta **cuándo te depositan** (antes o después del evento) — clave para tu flujo de caja con 1,500+ boletos.

---

## Siguientes pasos sugeridos

1. Pide cotización a **Passline** y **Boletia** con tus números reales (aforo, precio promedio, tipos de boleto: General/VIP).
2. Compara: comisión total, soporte el día del evento, cuándo liquidan, y si dan los lectores/app de acceso.
3. Crea el evento de prueba en la elegida y conecta el botón de tu página.
4. Haz un **simulacro de puerta**: compra un boleto de prueba, ábrelo en wallet, escanéalo, e intenta escanearlo dos veces (debe rechazarlo).

---

### Fuentes
- Boletia — métodos de pago y OXXO: https://help.boletia.com/hc/es-419/articles/12339550507917
- Boletia — OXXO Pay: https://knowledge.boletia.com/knowledge/c%C3%B3mo-funciona-el-m%C3%A9todo-de-pago-oxxo-pay
- Passline — servicios y control de acceso: https://www.passline.com/servicios_passline.php
- Passline — app lectora QR: https://play.google.com/store/apps/details?id=cl.passline.live
- Ticketopolis — plataforma de boletaje: https://www.ticketopolis.com/es/plataforma-de-boletaje.html
- Ticketmaster — boletos en Apple/Google Wallet: https://help.ticketmaster.com.mx/hc/en-us/articles/29777688300817
- Superboletos — boleto digital QR: https://web2.superboletos.com/boletodigital/
