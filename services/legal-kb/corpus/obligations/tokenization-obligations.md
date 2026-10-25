---
id: tokenization-obligations
title: Tokenization obligations checklist for Neko (Costa Rica first)
topic: obligations
jurisdiction: CR
as_of: 2026-10-25
in_force: vigente
strength: primary
keywords_es: tokenización, token, activo del mundo real, oferta pública de valores, oferta privada, SUGEVAL, autorización, cincuenta inversionistas, un millón de dólares, acreditación, consentimiento del inversionista, legitimación de capitales, proveedores de servicios de activos virtuales, inscripción SUGEF, conozca a su cliente, debida diligencia, beneficiario final, datos personales, consentimiento informado, Prodhab, inscripción de bases de datos, Regulation D, Regulation S, Crowdfunding, inversionista acreditado, SEP-57, registro de identidad, congelamiento
sources:
  - label: Ley 7732, Ley Reguladora del Mercado de Valores (SCIJ, version 14 of 14)
    url: https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=29302&param3=1
    type: primary
    date: 2026-09-02
  - label: Reglamento sobre Oferta Pública de Valores (SCIJ, version 23 of 23)
    url: https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=57105&param3=1
    type: primary
    date: 2026-10-05
  - label: Ley 7786 with the Ley 10961 reform (SCIJ, version 14 of 14)
    url: https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=29254&param2=152427&param3=1
    type: primary
    date: 2026-06-09
  - label: Ley 8968, Protección de la Persona frente al Tratamiento de sus Datos Personales (SCIJ)
    url: https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=70975&param3=1
    type: primary
    date: 2011-07-07
  - label: Decreto 37554-JP, Reglamento a la Ley 8968 (SCIJ)
    url: https://sinalevi.go.cr/ResultadosNormativa/Informacion?param1=74352&param3=1
    type: primary
    date: 2019-02-21
  - label: eCFR, 17 CFR part 230 (Regulation D and Regulation S) and part 227 (Regulation Crowdfunding)
    url: https://www.ecfr.gov/current/title-17
    type: primary
    date: 2026-10-19
  - label: OpenZeppelin stellar-contracts v0.8.0 RWA examples (SEP-57), as copied in contracts/rwa
    url: https://github.com/OpenZeppelin/stellar-contracts/tree/v0.8.0/examples/rwa
    type: secondary
    date: 2026-10-25
---

# Tokenization obligations checklist for Neko (Costa Rica first)

Not legal advice. This is a working checklist for the HackMeridian demo and for the talk with our lawyer. Every line cites the article it rests on; get the full text with `get_article`. Anything marked **(secondary)** is our reading or design, not backed by an ingested article. Final positions belong to a licensed lawyer.

Order: (a) is it a security and a public offering, (b) anti money laundering and VASP registration, (c) personal data from KYC, (d) US investors, (e) how the SEP-57 contract enforces each.

## (a) Is the token a security, and is the offering public? (SUGEVAL)

<!-- es: el token es un valor, contrato de inversión, oferta pública, oferta privada, autorización previa SUGEVAL, más de cincuenta inversionistas, medios de comunicación masiva, acreditación de oferta privada un millón de dólares, consentimiento firmado -->

1. **A tokenized real-world asset that pays investors is very likely a "valor".** A valor is any patrimonial right that can be traded and that raises funds from the public (ley-7732:art-2, reglamento-oferta-publica:art-2). Investment contracts are presumed to be valores when a fund-taker and passive investors meet and multiple instruments represent rights in a common business (reglamento-oferta-publica:art-4). A token sold to many passive investors in one asset fits this presumption. **(secondary: our reading)**
2. **The rules reach us even from abroad.** An offer is a Costa Rican public offer if it is made from Costa Rica or aimed at people domiciled in Costa Rica, wherever the trading happens (reglamento-oferta-publica:art-5).
3. **When it is presumed public.** Offering through mass media, or placing with more than 50 investors, is presumed a public offer (reglamento-oferta-publica:art-6). A public app open to anyone is mass media. **(secondary: our reading)**
4. **Public offer means prior SUGEVAL authorization.** Only series issues authorized by SUGEVAL can be offered publicly in the primary market (ley-7732:art-10, reglamento-oferta-publica:art-15). Authorization needs a filed request, issue documents, an external audit and a registered prospectus (ley-7732:art-11).
5. **Private offer path.** If the offer stays private: above USD 1,000,000 raised by one issuer or group it must be accredited with SUGEVAL, which is not an authorization (reglamento-oferta-publica:art-8-bis); the accreditation report is due within 10 business days and updated yearly (reglamento-oferta-publica:art-8-ter); and every investor signs a consent with the three warnings (not authorized by SUGEVAL, no regulated periodic information, no secondary market of registered securities), kept for 4 years (reglamento-oferta-publica:art-8-quater).
6. **SUGEVAL can rule case by case.** The Superintendent can exclude an offer after weighing number of investors, ticket size, investor type, total raised, media used and nature of the instrument (reglamento-oferta-publica:art-8). A formal consultation with our technical opinion is the way to get certainty for the Launchpad. **(secondary: recommendation)**

**Demo decision to confirm with the lawyer:** testnet only, fictional asset, so no real offer happens. For a real launch, choose between SUGEVAL authorization or a private offer capped at 50 investors with signed consents. **(secondary)**

## (b) Anti money laundering, KYC/KYB and SUGEF registration for Neko

<!-- es: proveedor de servicios de activos virtuales, inscripción ante SUGEF, Ley 10961, artículo 15 quater, identificación de clientes, beneficiario final, debida diligencia, personas expuestas políticamente, reporte de operaciones sospechosas UIF ICD, oficial de cumplimiento -->

1. **Neko is likely a virtual asset service provider (VASP).** A VASP is anyone who as a business exchanges, transfers or holds virtual assets, or provides financial services tied to issuing, selling or offering virtual assets for itself or clients (ley-7786:art-15-quater, added by Ley 10961 of 9 June 2026). The Launchpad and Neko Pro fit "issuance, commercialization, offer or sale". **(secondary: our reading)**
2. **Register with SUGEF before operating.** VASPs must register with SUGEF; registration is not an operating license and must be kept updated; supervised entities cannot do business with unregistered VASPs (ley-7786:art-15-quater).
3. **What the program must include** (ley-7786:art-15-quater, items a to j): customer and beneficial owner identification with reliable independent data; transaction records good enough to rebuild each transaction; PEP controls; risk controls for new products and technologies; controls on virtual asset transfers (travel rule data under the GAFI standard); enhanced controls for high-risk countries; suspicious transaction reports to the UIF of the ICD without delay; confidentiality of those reports; a documented risk assessment; and a compliance officer when SUGEF requires it.
4. **If the token is also a security**, the activity falls under the competent superintendency as well (ley-7786:art-15-quater, paragraph on regulated matters), so (a) and (b) add up, they do not replace each other.
5. **Detailed thresholds come from CONASSIF regulation**, which must set the due diligence amounts and the scope of these duties (ley-7786:art-15-quater, last paragraphs). That regulation is not in this knowledge base yet. **(secondary: gap)**

## (c) Personal data from KYC/KYB (Ley 8968)

<!-- es: datos personales, consentimiento informado, base de datos, inscripción en Prodhab, transferencia de datos, datos sensibles, calidad de los datos, diez años -->

1. **The law applies to our KYC database** (ley-8968:art-2). Personal data is any data about an identified or identifiable person (ley-8968:art-3).
2. **Informed consent before collecting.** Before asking for data, tell the person, expressly: that the database exists, the purposes, who receives the data, whether answers are mandatory, how data is treated, the consequences of refusing, their rights, and who is responsible and where (ley-8968:art-5). Consent must be free, specific, informed, unequivocal and individual (decreto-37554-jp:art-4), and given in a physical or electronic document; online, we must offer a consent procedure (decreto-37554-jp:art-5).
3. **Keep data current and limited to the purpose**; data that can harm the person is not kept beyond 10 years unless another norm requires it (ley-8968:art-6). AML record keeping is such a norm. **(secondary: our reading)**
4. **Sensitive data**: nobody is obliged to give it (ley-8968:art-9). KYC should not ask for it.
5. **Sharing KYC with issuers, Privy, Trustless Work or a KYC provider** needs the person's express authorization (ley-8968:art-14).
6. **Register the database with Prodhab** if it is administered for distribution, dissemination or commercialization (ley-8968:art-21). Whether a KYC database for our own compliance must be registered is a question for the lawyer. **(secondary)**
7. **Keep personal data off-chain.** The chain only stores the wallet address and claim hashes; names and documents stay in the backend. **(secondary: design)**

## (d) If US investors take part (Regulation D, S, Crowdfunding)

<!-- es: inversionistas de Estados Unidos, oferta fuera de Estados Unidos, inversionista acreditado, exención de registro, financiamiento colectivo, cinco millones -->

1. **Simplest path: exclude US persons.** Offers and sales outside the US are outside section 5 registration (us-17-cfr-230-reg-s:sec-230.901) when the sale is an offshore transaction with no directed selling efforts in the US, plus the category conditions (us-17-cfr-230-reg-s:sec-230.903).
2. **Rule 506.** Unlimited amount, treated as non-public: under 506(b) at most 35 non-accredited purchasers in 90 days and no general solicitation; under 506(c) only accredited investors with verification (us-17-cfr-230-reg-d:sec-230.506). Accredited investor is defined in us-17-cfr-230-reg-d:sec-230.501. Non-accredited buyers get disclosure (us-17-cfr-230-reg-d:sec-230.502).
3. **Regulation Crowdfunding.** Up to USD 5,000,000 per issuer in 12 months, with per-investor caps for non-accredited investors (us-17-cfr-227:sec-227.100), only through a registered intermediary. **(secondary for the intermediary part: section not reviewed here)**
4. For the demo: block US persons at KYC and in the contract country rules. **(secondary: design)**

## (e) How SEP-57 enforces each duty in the contract

<!-- es: SEP-57, registro de identidad, verificador de identidad, reclamaciones KYC, módulos de cumplimiento, congelar, recuperación, solo inversionistas verificados -->

All design, mapped to the contracts in `contracts/rwa` (OpenZeppelin v0.8.0). **(secondary)**

| Duty                                                             | Contract piece                                                                                                  | How                                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Only identified investors hold the token (a.5, b.3)              | `identity`, `claim-issuer`, `identity-registry`, `identity-verifier`                                            | A wallet can receive tokens only if its identity holds a valid KYC claim signed by a trusted issuer (Neko) |
| Max 50 investors for a private offer (a.3, a.5)                  | `compliance` hooks + a holder count module (not built yet)                                                      | Transfers that would add investor 51 are rejected                                                          |
| No US persons (d.1)                                              | Country data in `identity-registry` + a country restrict module (OpenZeppelin ships an example, not copied yet) | Transfers to wallets registered with a blocked country fail                                                |
| Freeze on a suspicious transaction or a sanctions list hit (b.3) | `token` `set_address_frozen`, `freeze_partial_tokens`                                                           | The operator can freeze a wallet or part of its balance                                                    |
| Lost wallet or court order (b.3)                                 | `token` `recover_balance`                                                                                       | Tokens move to the verified new wallet of the same identity                                                |
| Transfer history to rebuild transactions (b.3)                   | Stellar ledger + stellar.expert                                                                                 | Every transfer is public and dated                                                                         |
| Personal data stays off-chain (c.7)                              | Claims hold hashes only                                                                                         | KYC documents stay in the backend under Ley 8968                                                           |

## Open items for the lawyer

<!-- es: preguntas para el abogado, consulta a SUGEVAL, reglamento CONASSIF activos virtuales, inscripción Prodhab, Neko no constituida -->

1. Is a Launchpad token a valor and the offer public (reglamento-oferta-publica:art-4, art-6)? File a consultation under reglamento-oferta-publica:art-8?
2. Does Neko need SUGEF registration as a VASP before any real issuance (ley-7786:art-15-quater)? Neko is not incorporated yet, so who registers?
3. CONASSIF VASP regulation: thresholds and timing (not ingested).
4. Prodhab registration of the KYC database (ley-8968:art-21).
