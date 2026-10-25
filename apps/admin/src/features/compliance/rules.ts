import type {
  AdminApplicationView,
  ComplianceCheck,
  ComplianceCitation,
} from "@/lib/types";

const CITE = {
  ley7786_15q: { norm: "ley-7786", article: "15-quater" },
  ley7732_2: { norm: "ley-7732", article: "2" },
  reglamento4: { norm: "reglamento-oferta-publica", article: "4" },
  reglamento5: { norm: "reglamento-oferta-publica", article: "5" },
  reglamento6: { norm: "reglamento-oferta-publica", article: "6" },
  ley7732_10: { norm: "ley-7732", article: "10" },
  ley7732_11: { norm: "ley-7732", article: "11" },
  reglamento8bis: { norm: "reglamento-oferta-publica", article: "8-bis" },
  reglamento8ter: { norm: "reglamento-oferta-publica", article: "8-ter" },
  reglamento8quater: {
    norm: "reglamento-oferta-publica",
    article: "8-quater",
  },
  ley8968_5: { norm: "ley-8968", article: "5" },
  decreto37554_5: { norm: "decreto-37554-jp", article: "5" },
  ley8968_14: { norm: "ley-8968", article: "14" },
  regD506: { norm: "us-17-cfr-230-reg-d", article: "230.506" },
  regD501: { norm: "us-17-cfr-230-reg-d", article: "230.501" },
  regS903: { norm: "us-17-cfr-230-reg-s", article: "230.903" },
  mxLmv8: { norm: "mx-lmv", article: "8" },
  coLey964: { norm: "co-ley-964-2005", article: "2" },
  coLey1258: { norm: "co-ley-1258-2008", article: "4" },
  arLey26831: { norm: "ar-ley-26831", article: "2" },
} as const satisfies Record<string, ComplianceCitation>;

function isPublicOffer(app: AdminApplicationView): {
  fails: boolean;
  triggers: string[];
} {
  const triggers: string[] = [];
  if (app.offering_type === "public") {
    triggers.push("public offering selected");
  }
  if (app.uses_mass_marketing) {
    triggers.push("mass media / mass marketing");
  }
  if (app.max_investors == null) {
    triggers.push("investor cap not set");
  } else if (app.max_investors > 50) {
    triggers.push("more than 50 investors");
  }
  return { fails: triggers.length > 0, triggers };
}

function milestonesSumOk(app: AdminApplicationView): boolean {
  if (!app.milestones || app.milestones.length === 0) return false;
  const sum = app.milestones.reduce((acc, m) => acc + Number(m.amount_pct), 0);
  return Math.abs(sum - 100) < 0.001;
}

/**
 * Pure, deterministic compliance checklist for an admin application view.
 * Easy to unit-test later; no I/O and no LLM.
 */
export function evaluateCompliance(
  app: AdminApplicationView
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  checks.push({
    id: "issuer-verified",
    title: "Issuer verified (KYB/KYC)",
    status: app.issuer.verification.status === "approved" ? "pass" : "fail",
    detail:
      app.issuer.verification.status === "approved"
        ? "Issuer verification is approved."
        : `Issuer verification status is "${app.issuer.verification.status}", not approved.`,
    citations: [CITE.ley7786_15q],
  });

  checks.push({
    id: "likely-security",
    title: "Token is likely a security",
    status: "info",
    detail:
      "A token that pays passive investors from a common business is presumed a valor.",
    citations: [CITE.ley7732_2, CITE.reglamento4],
  });

  const publicOffer = isPublicOffer(app);
  checks.push({
    id: "public-offering-test",
    title: "Public offering test (Costa Rica)",
    status: publicOffer.fails ? "fail" : "pass",
    detail: publicOffer.fails
      ? `A public offer needs prior SUGEVAL authorization. Triggered by: ${publicOffer.triggers.join(", ")}.`
      : "Private offer: 50 investors or fewer, no mass marketing.",
    citations: [
      CITE.reglamento5,
      CITE.reglamento6,
      CITE.ley7732_10,
      CITE.ley7732_11,
    ],
  });

  if (!publicOffer.fails) {
    const currency = (app.currency || "").toUpperCase();
    if (currency !== "USD") {
      checks.push({
        id: "private-offer-accreditation",
        title: "Private offer accreditation with SUGEVAL",
        status: "warn",
        detail: "Check the USD equivalent",
        citations: [CITE.reglamento8bis, CITE.reglamento8ter],
      });
    } else if (Number(app.target_amount) > 1_000_000) {
      checks.push({
        id: "private-offer-accreditation",
        title: "Private offer accreditation with SUGEVAL",
        status: "warn",
        detail:
          "Target amount exceeds USD 1,000,000. Accredit within 10 business days of passing the threshold, and update yearly.",
        citations: [CITE.reglamento8bis, CITE.reglamento8ter],
      });
    } else {
      checks.push({
        id: "private-offer-accreditation",
        title: "Private offer accreditation with SUGEVAL",
        status: "pass",
        detail:
          "Target amount is at or below USD 1,000,000; private-offer accreditation threshold not crossed.",
        citations: [CITE.reglamento8bis, CITE.reglamento8ter],
      });
    }

    checks.push({
      id: "investor-consent",
      title: "Signed investor consent (private offer)",
      status: "info",
      detail:
        "Every investor signs the three warnings before investing, kept 4 years.",
      citations: [CITE.reglamento8quater],
    });
  }

  checks.push({
    id: "neko-sugef",
    title: "Neko registered with SUGEF as a virtual asset service provider",
    status: "warn",
    detail:
      "Registration is not an operating license; required before real issuance.",
    citations: [CITE.ley7786_15q],
  });

  checks.push({
    id: "personal-data-consent",
    title: "Personal data consent for KYC",
    status: "info",
    detail:
      "Collect and keep explicit consent for personal data used in KYC/KYB.",
    citations: [CITE.ley8968_5, CITE.decreto37554_5, CITE.ley8968_14],
  });

  const countries = app.investor_countries ?? [];
  const includesUs =
    app.accepts_us_investors || countries.some((c) => c.toUpperCase() === "US");
  checks.push({
    id: "us-investors",
    title: "US investors",
    status: includesUs ? "warn" : "pass",
    detail: includesUs
      ? "Needs Rule 506(c) (accredited only, verified) or exclude US persons under Regulation S."
      : "US persons excluded; enforce with a country rule in the SEP-57 compliance module.",
    citations: [CITE.regD506, CITE.regD501, CITE.regS903],
  });

  const countryLines: string[] = [];
  const countryCitations: ComplianceCitation[] = [];
  if (countries.some((c) => c.toUpperCase() === "MX")) {
    countryLines.push(
      "MX: private offer only to qualified investors or fewer than 100 people."
    );
    countryCitations.push(CITE.mxLmv8);
  }
  if (countries.some((c) => c.toUpperCase() === "CO")) {
    countryLines.push(
      "CO: securities law applies; SAS issuers cannot be listed."
    );
    countryCitations.push(CITE.coLey964, CITE.coLey1258);
  }
  if (countries.some((c) => c.toUpperCase() === "AR")) {
    countryLines.push("AR: check the public offer definition.");
    countryCitations.push(CITE.arLey26831);
  }

  checks.push({
    id: "other-countries",
    title: "Other countries",
    status: countryLines.length > 0 ? "warn" : "info",
    detail:
      countryLines.length > 0
        ? countryLines.join(" ")
        : "No MX, CO, or AR investors listed; review any other jurisdictions as needed.",
    citations: countryCitations,
  });

  const milestonesOk = milestonesSumOk(app);
  checks.push({
    id: "milestones-sum",
    title: "Milestones add up to 100%",
    status: milestonesOk ? "pass" : "warn",
    detail: milestonesOk
      ? "Milestone amount_pct values sum to 100%."
      : "Milestones are missing or amount_pct does not sum to 100%. Trustless Work escrow releases by milestone.",
    citations: [],
  });

  return checks;
}
