---
id: latam-spv-and-obligations
title: Mexico, Colombia and Argentina, SPV vehicles and tokenization obligations
topic: obligations
jurisdiction: MX, CO, AR
as_of: 2026-10-25
in_force: vigente
strength: primary
keywords_es: México, Colombia, Argentina, SPV, vehículo de propósito especial, fideicomiso, fiduciario, sociedad por acciones simplificada, SAS, oferta pública, oferta privada, Registro Nacional de Valores, CNBV, Superintendencia Financiera, CNV, Ley Fintech, institución de financiamiento colectivo, activos virtuales, PSAV, UIF, sujetos obligados, lavado de activos
sources:
  - label: Ley para Regular las Instituciones de Tecnología Financiera, CNBV compilation with reforms to DOF 2025-11-14
    url: https://www.cnbv.gob.mx/Normatividad/Ley%20para%20Regular%20las%20Instituciones%20de%20Tecnolog%C3%ADa%20Financiera.pdf
    type: primary
    date: 2025-11-14
  - label: Ley del Mercado de Valores, CNBV compilation
    url: https://www.cnbv.gob.mx/Normatividad/Ley%20del%20Mercado%20de%20Valores.pdf
    type: primary
    date: 2026
  - label: Ley General de Títulos y Operaciones de Crédito, Orden Jurídico Nacional (last reform DOF 2024)
    url: https://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo42.html
    type: primary
    date: 2024
  - label: Ley 964 de 2005 and Ley 1258 de 2008, Secretaría del Senado (updated 2026-10-15)
    url: http://www.secretariasenado.gov.co/senado/basedoc/ley_0964_2005.html
    type: primary
    date: 2026-10-15
  - label: Ley 26.831 and Ley 25.246 (with Ley 27.739), InfoLEG updated texts
    url: https://servicios.infoleg.gob.ar/infolegInternet/anexos/205000-209999/206592/texact.htm
    type: primary
    date: 2026-10-25
---

# Mexico, Colombia and Argentina, SPV vehicles and tokenization obligations

Not legal advice. Same rules as the Costa Rica checklist (see tokenization-obligations): every line cites an article id, our readings are marked **(secondary)**, final positions belong to a lawyer licensed in that country.

Pattern in all three countries: the asset sits in an SPV (a trust or a company), the SPV issues the tokens, and the token is very likely a security, so a public offer needs the regulator and a private offer must stay inside the exemption. Whoever runs the platform is also an AML obligated party. **(secondary: our reading)**

## Mexico

<!-- es: México, fideicomiso como SPV, institución fiduciaria, oferta pública Registro Nacional de Valores CNBV, oferta privada menos de cien personas inversionistas institucionales o calificados, Ley Fintech, financiamiento colectivo, activos virtuales Banco de México -->

1. **SPV: the fideicomiso.** The settlor transfers ownership of assets or rights to a trust institution for lawful, determined purposes (mx-lgtoc:art-381). Any asset or right can be placed in trust, and trust assets are ring-fenced to that purpose (mx-lgtoc:art-386). Beneficiaries can be named later (mx-lgtoc:art-382). Only authorized institutions act as trustee (mx-lgtoc:art-385). **(secondary: check the full list in art-385)**
2. **Public offer means registration.** Securities offered publicly in Mexico must be registered in the Registro Nacional de Valores (mx-lmv:art-7).
3. **Private offer exemptions.** Unregistered securities can be offered privately only to institutional or qualified investors, or (for equity) to fewer than 100 people, or under employee plans, among others; the CNBV can authorize other private offers (mx-lmv:art-8).
4. **Crowdfunding platforms need a license.** Putting members of the public in contact so they finance each other through apps or websites, habitually and professionally, is reserved to CNBV-authorized institutions de financiamiento colectivo (mx-lritf:art-15), and any ITF needs CNBV authorization (mx-lritf:art-11).
5. **Virtual assets under the Fintech law** are a digital representation of value used as a means of payment, and ITFs may only operate the ones Banco de México allows (mx-lritf:art-30). A tokenized security is treated as a security first, not as a "virtual asset" in this sense. **(secondary: our reading)**
6. **AML (LFPIORPI): not ingested.** The reachable copy stops at the 2021 reform and misses the 2025-07-16 reform. Virtual asset activities are a "vulnerable activity" under that law. **(secondary: gap)**

## Colombia

<!-- es: Colombia, sociedad por acciones simplificada SAS como SPV, no puede inscribirse en el Registro Nacional de Valores ni negociarse en bolsa, concepto de valor captación de recursos del público, actividades del mercado de valores, Superintendencia Financiera -->

1. **Security test.** A valor is any negotiable right that is part of an issue and aims to raise funds from the public, including titles from a securitization (co-ley-964-2005:art-2). Issuing and offering valores is a securities market activity (co-ley-964-2005:art-3) under the government's intervention and the SFC's supervision (co-ley-964-2005:art-4). **(secondary for the SFC supervision detail)**
2. **SPV: the SAS, with a hard limit.** One or more people can form an SAS with liability limited to their contributions (co-ley-1258-2008:art-1). But SAS shares and other securities **cannot be registered in the Registro Nacional de Valores y Emisores nor traded on an exchange** (co-ley-1258-2008:art-4). So an SAS-based token can only be placed privately. **(secondary: our reading)**
3. **Fiducia mercantil (trust) is in the Código de Comercio**, which is not ingested yet. **(secondary: gap)**
4. **AML** in Colombia is set by SFC circulars (SARLAFT) and UIAF rules, not by a single law; not ingested. **(secondary: gap)**

## Argentina

<!-- es: Argentina, oferta pública invitación a personas en general valores negociables, CNV, fideicomiso financiero, tokenización RG 1069, proveedores de servicios de activos virtuales PSAV sujetos obligados UIF Ley 27.739 -->

1. **Public offer.** An invitation to people in general, or to sectors or groups, to do any legal act with valores negociables, through personal offers, press, broadcasts, posters and similar means, is a public offer (ar-ley-26831:art-2), regulated by the CNV.
2. **Virtual assets and PSAV.** A virtual asset is a digital representation of value that can be traded or transferred digitally and used for payments or investments (ar-ley-25246:art-4-bis). Virtual asset service providers are obligated parties that must report to the UIF (ar-ley-25246:art-20, item 13), after the Ley 27.739 reform.
3. **Tokenization regime.** CNV RG 1069/2025 lets financial trusts and closed funds with public offering tokenize real-world assets, operated through CNV-registered PSAVs. Not ingested (the Boletín Oficial was not reachable from here). **(secondary: gap)**
4. **SPV: the fideicomiso financiero** (Código Civil y Comercial) is not ingested yet. **(secondary: gap)**

## What this means for Neko

<!-- es: qué significa para Neko, expansión regional, mismo modelo, oferta privada, KYC, contrato SEP-57 por país -->

- The same SEP-57 setup works in every country: the identity registry holds the investor's country, and compliance modules can cap holders (Mexico under 100 for equity private offers, Costa Rica 50) or block countries. **(secondary: design)**
- Launch country by country with a local lawyer; in Colombia an SAS issuer means private placement only (co-ley-1258-2008:art-4).

## Gaps to fill next

<!-- es: pendientes, LFPIORPI 2025, Código de Comercio fiducia, Código Civil y Comercial fideicomiso, RG 1069 CNV, SARLAFT -->

1. Mexico LFPIORPI with the 2025-07-16 reform (diputados.gob.mx).
2. Colombia Código de Comercio, fiducia mercantil (arts. 1226 and following), and the SFC AML circular.
3. Argentina CNV RG 1069/2025 and RG 1081/2025 (tokenization), and the Código Civil y Comercial fideicomiso (arts. 1666 and following).
