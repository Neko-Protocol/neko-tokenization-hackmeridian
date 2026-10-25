# Product flows

Mermaid diagrams. GitHub renders them here; paste into [mermaid.live](https://mermaid.live) to export PNG or SVG for the deck. Source: whiteboard of [session 01](../sessions/session-01.md).

## Full picture

```mermaid
flowchart LR
  subgraph Issuers
    T1["Already tokenizes<br/>e.g. RedSwan, Etherfuse"]
    T2["Wants to tokenize"] --> LP["Launchpad<br/>KYB, AI form, approval,<br/>wallet, tokenization"]
  end
  T1 --> NP
  LP --> NP["Neko Pro<br/>opportunities shelf"]
  NP --> INV["Verified investor<br/>KYC, filters, dashboard"]
```

## 1. Issuer that already tokenizes: distribution

```mermaid
flowchart LR
  I["Issuer that already tokenizes<br/>e.g. RedSwan, Etherfuse"] -->|comes to| N((Neko))
  N -->|sells to| V((Investor))
  I -. "B2B: 0.4% commission<br/>+ one-time listing fee" .-> N
```

## 2. Issuer that wants to tokenize: Launchpad

Looks for infrastructure (smart contracts, front end, back end), a legal structure and no jargon.

```mermaid
flowchart LR
  A["1. KYB / KYC"] --> B["2. Form<br/>(AI assisted)"]
  B --> C{"3. Neko approval<br/>legal and compliance"}
  C -->|approved| D["4. Create wallet"]
  C -->|changes needed| B
  D --> E["5. Tokenization"] --> F["Launch"] --> G["Issuer dashboard"]
```

## 3. Investor: Neko Pro

```mermaid
flowchart LR
  K["1. KYC / KYB"] --> O["2. Opportunities<br/>with filters"] --> P["3. Dashboard"]
```

## 4. The money, end to end

How a vault's cash actually moves. Source: `contracts/vault/`.

```mermaid
sequenceDiagram
  participant I as Investors
  participant V as Vault
  participant T as Vault token
  participant B as Issuer (borrower)

  Note over I,B: Funding
  I->>V: invest(USDC)
  V->>T: mint 1:1 (fails without KYC)
  T-->>I: vault tokens
  V->>B: release the raise

  Note over I,B: Repayment, tranche by tranche
  B->>V: repay(tranche 1..n)
  Note over V: at the full amount with interest,<br/>the supply is frozen and the vault settles

  Note over I,B: Payout
  I->>V: redeem()
  V->>T: burn the investor's tokens
  V-->>I: share of everything repaid
```

Leaving early: `early_exit()` returns the capital minus the exit fee and burns the
tokens, out of whatever the borrower has repaid so far. The forfeited interest
stays in the pot, so the holders who stay collect slightly more than their
headline rate.

## 5. The contracts

```mermaid
flowchart TB
  subgraph shared["Shared, deployed once"]
    CTI["Claim topics<br/>and issuers"]
    CI["Claim issuer"]
    IR["Identity registry"]
    IV["Identity verifier"]
    F["Factory"]
    MT["Milestone tracker"]
  end
  subgraph vault["Per vault, deployed by the factory"]
    TK["SEP-57 token"]
    CO["Compliance"]
    VA["Vault"]
  end
  ID["Identity<br/>(one per investor)"]

  F -.deploys.-> TK & CO & VA
  TK --> IV --> IR --> ID
  IV --> CTI --> CI
  TK --> CO
  VA -->|mint and burn| TK
```
