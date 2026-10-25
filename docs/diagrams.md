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
