export type Grade = "A" | "B" | "C" | "D" | "F";
export type RevenueOpportunity = "Low" | "Moderate" | "High";

export interface PageData {
  url: string;
  title: string;
  metaDescription: string;
  h1Tags: string[];
  h2Tags: string[];
  hasCTA: boolean;
  ctaText: string[];
  hasForm: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasBookingLanguage: boolean;
  hasChatWidget: boolean;
  hasTrustSignals: boolean;
  wordCount: number;
  fullText: string;
  fetchFailed: boolean;
}

export interface InsightItem {
  category: string; // category key, e.g. "website_conversion"; "general" for fallbacks
  text: string;
}

export interface GradeReport {
  overall_grade: Grade;
  category_grades: {
    website_conversion: Grade;
    search_visibility: Grade;
    paid_traffic_readiness: Grade;
    lead_capture: Grade;
  };
  headline: string;
  top_insights: InsightItem[];
  revenue_opportunity: RevenueOpportunity;
  cta_title: string;
  cta_body: string;
}

// ─── Signal lists ─────────────────────────────────────────────────────────────

const POWER_CTA_PHRASES = [
  "get started", "get a quote", "get a free", "book a", "schedule a",
  "free consultation", "free quote", "contact us today", "call us now",
  "request a", "apply now", "book now", "start today", "try free",
  "let's talk", "speak with", "get in touch", "claim your",
];

const BENEFIT_CTA_WORDS = [
  "free", "quote", "consultation", "book", "schedule", "demo",
  "start", "today", "now", "get", "claim",
];

const TRUST_SIGNALS = [
  "years of experience", "years in business", "clients served",
  "guaranteed", "certified", "award", "trusted by", "rated",
  "proven results", "since 19", "since 20", "satisfaction guarantee",
  "5-star", "testimonial", "case study", "reviews",
];

const BOOKING_SIGNALS = [
  "schedule", "book an appointment", "book a call", "consultation",
  "free meeting", "call us", "reserve", "availability",
];

const CHAT_SIGNALS = [
  "intercom", "drift", "hubspot", "tidio", "crisp",
  "zendesk", "freshchat", "livechat", "tawk", "olark",
];

// ─── Grade utilities ──────────────────────────────────────────────────────────

function gradeToNumeric(grade: Grade): number {
  return { A: 4, B: 3, C: 2, D: 1, F: 0 }[grade];
}

// Maps a rounded integer (0–4) back to a grade
function gradeFromInt(n: number): Grade {
  return (["F", "D", "C", "B", "A"] as Grade[])[Math.max(0, Math.min(4, Math.round(n)))];
}

// Converts a floating-point average to a grade (used for overall calculation)
function numericToGrade(n: number): Grade {
  if (n >= 3.5) return "A";
  if (n >= 2.5) return "B";
  if (n >= 1.5) return "C";
  if (n >= 0.5) return "D";
  return "F";
}

// ─── Category scoring (gate-based) ───────────────────────────────────────────
//
// Each category uses a two-layer approach:
//   1. Gate checks  — failing critical signals drives D or F immediately
//   2. Bonus checks — quality signals push from C toward B or A
//
// Distribution target: A ~5%, B ~20%, C ~45%, D ~25%, F ~5%
// When signals are ambiguous, default to C.

export function scoreWebsiteConversion(data: PageData): Grade {
  const ctaLower = data.ctaText.map((t) => t.toLowerCase()).join(" ");
  const hasMeaningfulH1 = data.h1Tags.length > 0 && data.h1Tags[0].trim().length > 15;
  const hasPowerCTA = POWER_CTA_PHRASES.some((kw) => ctaLower.includes(kw));

  // Gate layer — critical failures
  if (!hasMeaningfulH1 && !data.hasCTA) return "F";
  if (!hasMeaningfulH1 || !data.hasCTA) return "D";

  // Bonus layer — quality signals
  let bonus = 0;
  if (hasPowerCTA) bonus++;                                              // Specific conversion language
  if (data.title && data.title.trim().length > 35) bonus++;              // Descriptive title
  if (data.metaDescription && data.metaDescription.trim().length > 100) bonus++; // Compelling meta
  if (data.hasTrustSignals) bonus++;                                     // Credibility signals
  if (data.h1Tags[0].trim().length > 30) bonus++;                        // Substantive value prop

  if (bonus >= 5) return "A";
  if (bonus >= 4) return "B"; // Requires 4 of 5 quality signals — good but not exceptional
  return "C"; // Default when gates pass
}

export function scoreSearchVisibility(data: PageData): Grade {
  const hasMeaningfulTitle = data.title && data.title.trim().length > 10;
  const hasMeaningfulH1 = data.h1Tags.length > 0 && data.h1Tags[0].trim().length > 10;

  // Gate layer
  if (!hasMeaningfulTitle && !hasMeaningfulH1) return "F";
  if (!hasMeaningfulH1) return "D";
  if (!hasMeaningfulTitle || data.wordCount < 100) return "D";

  // Bonus layer
  let bonus = 0;
  if (data.metaDescription && data.metaDescription.trim().length > 80) bonus++;  // Meta present
  if (data.title.trim().length > 30) bonus++;                                      // Descriptive title
  if (data.h1Tags[0].trim().length > 20) bonus++;                                  // Substantive H1
  if (data.h2Tags.length >= 3) bonus++;                                            // Content structure
  if (data.wordCount > 800) bonus++;                                               // Topical depth

  if (bonus >= 5) return "A";
  if (bonus >= 4) return "B";
  return "C";
}

export function scorePaidTrafficReadiness(data: PageData): Grade {
  const hasMeaningfulH1 = data.h1Tags.length > 0 && data.h1Tags[0].trim().length > 10;
  const hasConversionMechanism = data.hasForm || data.hasPhone;
  const ctaLower = data.ctaText.map((t) => t.toLowerCase()).join(" ");
  const hasBenefitCTA = BENEFIT_CTA_WORDS.some((kw) => ctaLower.includes(kw));

  // Gate layer
  if (!hasMeaningfulH1 && !hasConversionMechanism) return "F";
  if (!hasMeaningfulH1 || !hasConversionMechanism) return "D";

  // Bonus layer
  let bonus = 0;
  if (data.h1Tags[0].trim().length > 30) bonus++;              // Strong above-fold message
  if (hasBenefitCTA && data.hasCTA) bonus++;                   // Benefit-oriented CTA
  if (data.hasForm && data.hasPhone) bonus++;                   // Multiple conversion paths
  if (data.hasTrustSignals) bonus++;                            // Reduces ad traffic skepticism
  if (data.metaDescription && data.metaDescription.trim().length > 80) bonus++; // Clear offer signal

  if (bonus >= 5) return "A";
  if (bonus >= 4) return "B";
  return "C";
}

export function scoreLeadCapture(data: PageData): Grade {
  // Count substantive capture methods (email-only or booking-only are weak)
  const captureCount = [
    data.hasPhone,
    data.hasForm,
    data.hasEmail,
    data.hasBookingLanguage,
  ].filter(Boolean).length;

  // Gate layer — by capture method count
  if (captureCount === 0) return "F";
  if (captureCount === 1) return "D"; // Single path severely limits conversion breadth

  // 2+ methods — now score the specific mix
  let score = 0;
  if (data.hasPhone) score++;
  if (data.hasForm) score++;
  if (data.hasBookingLanguage) score++;
  if (data.hasChatWidget) score++;
  if (data.hasEmail) score++;

  if (score >= 5) return "A"; // All methods present
  if (score >= 3) return "B"; // Strong multi-channel capture
  return "C";                  // Basic multi-channel (2 methods)
}

// ─── Overall grade ────────────────────────────────────────────────────────────

export function computeOverallGrade(categoryGrades: {
  website_conversion: Grade;
  search_visibility: Grade;
  paid_traffic_readiness: Grade;
  lead_capture: Grade;
}): Grade {
  const values = Object.values(categoryGrades).map(gradeToNumeric);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const rawGrade = numericToGrade(avg);
  const rawValue = gradeToNumeric(rawGrade);

  // Guardrail: overall cannot exceed the weakest category by more than one grade step.
  // This prevents a strong average from masking a meaningful structural weakness.
  const worstValue = Math.min(...values);
  const maxAllowed = worstValue + 1; // One step above worst

  const finalValue = Math.min(rawValue, maxAllowed);
  return gradeFromInt(finalValue);
}

// ─── Headlines ────────────────────────────────────────────────────────────────

export function generateHeadline(grade: Grade): string {
  const headlines: Record<Grade, string> = {
    A: "Your website shows strong performance across most revenue dimensions — some upside remains.",
    B: "Your website has a solid foundation, though measurable revenue gaps are present across key channels.",
    C: "Your website has moderate signals, but meaningful conversion and visibility gaps are likely suppressing growth.",
    D: "Your website has clear structural weaknesses that are actively limiting its ability to generate leads and revenue.",
    F: "Your website appears to have critical gaps that may be preventing meaningful lead generation or organic growth.",
  };
  return headlines[grade];
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export function generateTopInsights(
  data: PageData,
  categoryGrades: {
    website_conversion: Grade;
    search_visibility: Grade;
    paid_traffic_readiness: Grade;
    lead_capture: Grade;
  }
): InsightItem[] {
  interface Candidate {
    priority: number; // Lower = worse, shown first
    category: string;
    insight: string;
  }

  const candidates: Candidate[] = [];
  const gradePriority: Record<Grade, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };

  // ── Website Conversion ──
  const wc = categoryGrades.website_conversion;
  if (wc === "F" || wc === "D") {
    const noH1 = data.h1Tags.length === 0 || data.h1Tags[0].trim().length < 15;
    candidates.push({
      priority: gradePriority[wc],
      category: "website_conversion",
      insight: noH1
        ? "Your website does not immediately communicate a clear value proposition, which may reduce conversion confidence before visitors reach a decision point."
        : "Without a clear, action-oriented path forward, visitors arriving with intent may be leaving before completing a meaningful action — suppressing inquiry rates.",
    });
  } else if (wc === "C") {
    candidates.push({
      priority: gradePriority[wc],
      category: "website_conversion",
      insight:
        "While basic conversion elements are present, the messaging may not be differentiated enough to build confidence with unfamiliar visitors — leaving conversion potential unrealized.",
    });
  } else if (wc === "B") {
    candidates.push({
      priority: gradePriority[wc],
      category: "website_conversion",
      insight:
        "Conversion signals are present but the depth of trust-building and offer clarity may not be strong enough to capture the full range of visitor intent arriving at the page.",
    });
  }

  // ── Search Visibility ──
  const sv = categoryGrades.search_visibility;
  if (sv === "F" || sv === "D") {
    candidates.push({
      priority: gradePriority[sv],
      category: "search_visibility",
      insight:
        !data.metaDescription || data.metaDescription.length < 50
          ? "Search visibility appears limited beyond branded discovery, which restricts new customer acquisition to audiences already aware of you."
          : "Thin on-page content may signal low topical authority to search engines, limiting organic rankings for category-level queries.",
    });
  } else if (sv === "C") {
    candidates.push({
      priority: gradePriority[sv],
      category: "search_visibility",
      insight:
        "The on-page content structure is partially optimized, but gaps in topical depth and content hierarchy may be limiting how broadly search engines surface your pages.",
    });
  } else if (sv === "B") {
    candidates.push({
      priority: gradePriority[sv],
      category: "search_visibility",
      insight:
        "Search visibility shows a reasonable foundation, but the site may be underperforming for non-branded category queries — limiting reach to audiences not yet aware of the business.",
    });
  }

  // ── Paid Traffic Readiness ──
  const pt = categoryGrades.paid_traffic_readiness;
  if (pt === "F" || pt === "D") {
    candidates.push({
      priority: gradePriority[pt],
      category: "paid_traffic_readiness",
      insight:
        "The current site structure suggests paid traffic would face significant friction before reaching a clear next step, which typically results in elevated cost-per-lead and poor return on ad spend.",
    });
  } else if (pt === "C") {
    candidates.push({
      priority: gradePriority[pt],
      category: "paid_traffic_readiness",
      insight:
        "The page has partial conversion infrastructure, but offer clarity and above-the-fold messaging may not be compelling enough to convert cold paid traffic at an efficient cost.",
    });
  } else if (pt === "B") {
    candidates.push({
      priority: gradePriority[pt],
      category: "paid_traffic_readiness",
      insight:
        "Paid traffic readiness is solid, though the absence of layered trust signals and a sharper conversion path may be limiting the quality of leads generated from paid channels.",
    });
  }

  // ── Lead Capture ──
  const lc = categoryGrades.lead_capture;
  if (lc === "F" || lc === "D") {
    candidates.push({
      priority: gradePriority[lc],
      category: "lead_capture",
      insight:
        !data.hasForm && !data.hasPhone
          ? "The site appears to lack clear capture mechanisms, which means visitors who are ready to engage may have no direct path to convert — resulting in lost lead volume."
          : "Limited capture pathways suggest that interested visitors may be disengaging before taking a meaningful action — reducing lead volume from existing traffic.",
    });
  } else if (lc === "C") {
    candidates.push({
      priority: gradePriority[lc],
      category: "lead_capture",
      insight:
        "A narrow set of capture options may be suppressing conversion volume, as different buyers prefer different engagement channels — this gap likely limits total leads generated.",
    });
  } else if (lc === "B") {
    candidates.push({
      priority: gradePriority[lc],
      category: "lead_capture",
      insight:
        "Capture pathways are functional, but the absence of lower-friction options — such as scheduling or live engagement — may be slowing the buyer journey for some visitor segments.",
    });
  }

  // Sort worst-first, take top 3
  candidates.sort((a, b) => a.priority - b.priority);

  const fallbacks: InsightItem[] = [
    { category: "general", text: "The alignment between traffic sources and on-page messaging may not be strong enough to convert visitors arriving without prior brand awareness." },
    { category: "general", text: "Strengthening the visibility of social proof and authority signals could reduce buyer hesitation and increase both the quality and volume of leads generated." },
    { category: "general", text: "The gap between site traffic potential and actual revenue capture suggests an optimization opportunity that a structured paid and conversion strategy could address." },
  ];

  const result: InsightItem[] = candidates.slice(0, 3).map((c) => ({ category: c.category, text: c.insight }));
  while (result.length < 3) {
    result.push(fallbacks[result.length]);
  }

  return result.slice(0, 3);
}

// ─── Revenue Opportunity ──────────────────────────────────────────────────────
//
// Conservative by design. Even strong sites should surface remaining upside.
// A → Moderate (unless perfect across all categories → Low, which is near-impossible)
// B → High if any category is C or below; Moderate if all B/A
// C/D/F → High

export function determineRevenueOpportunity(
  overallGrade: Grade,
  categoryGrades: {
    website_conversion: Grade;
    search_visibility: Grade;
    paid_traffic_readiness: Grade;
    lead_capture: Grade;
  }
): RevenueOpportunity {
  const grades = Object.values(categoryGrades);
  const hasWeak = grades.some((g) => g === "D" || g === "F");
  const hasAverage = grades.some((g) => g === "C");
  const allA = grades.every((g) => g === "A");

  if (overallGrade === "F" || overallGrade === "D") return "High";
  if (overallGrade === "C") return "High";

  if (overallGrade === "B") {
    if (hasWeak || hasAverage) return "High";
    return "Moderate";
  }

  if (overallGrade === "A") {
    if (allA) return "Low"; // Effectively never reached with conservative scoring
    return "Moderate";
  }

  return "High"; // Fallback — always conservative
}

// ─── Page data extraction ─────────────────────────────────────────────────────

export function extractPageData(
  url: string,
  html: string,
  fetchFailed = false
): PageData {
  const fullText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const fullTextLower = fullText.toLowerCase();
  const htmlLower = html.toLowerCase();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

  const metaMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const metaDescription = metaMatch ? metaMatch[1].trim() : "";

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1Tags = h1Matches.map((m) => m[1].replace(/<[^>]+>/g, "").trim());

  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const h2Tags = h2Matches.map((m) => m[1].replace(/<[^>]+>/g, "").trim());

  const ctaMatches = [...html.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)];
  const ctaText = ctaMatches
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter((t) => t.length > 0 && t.length < 80);

  const ctaLower = ctaText.map((t) => t.toLowerCase()).join(" ");
  const hasCTA =
    POWER_CTA_PHRASES.some((kw) => ctaLower.includes(kw)) ||
    BENEFIT_CTA_WORDS.some((kw) => ctaLower.includes(kw));

  const hasForm =
    /<form[\s\S]*?<\/form>/i.test(html) ||
    /<input[^>]+type=["'](?:text|email|tel|submit)["']/i.test(html);

  const phonePattern = /(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
  const hasPhone = phonePattern.test(fullText);

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const hasEmail = emailPattern.test(fullText);

  const hasBookingLanguage = BOOKING_SIGNALS.some((sig) => fullTextLower.includes(sig));
  const hasChatWidget = CHAT_SIGNALS.some((sig) => htmlLower.includes(sig));
  const hasTrustSignals = TRUST_SIGNALS.some((sig) => fullTextLower.includes(sig.toLowerCase()));
  const wordCount = fullText.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    url,
    title,
    metaDescription,
    h1Tags,
    h2Tags,
    hasCTA,
    ctaText,
    hasForm,
    hasPhone,
    hasEmail,
    hasBookingLanguage,
    hasChatWidget,
    hasTrustSignals,
    wordCount,
    fullText: fullText.slice(0, 5000),
    fetchFailed,
  };
}

export function generateFallbackPageData(url: string): PageData {
  const urlObj = (() => {
    try { return new URL(url.startsWith("http") ? url : `https://${url}`); }
    catch { return null; }
  })();

  return {
    url,
    title: urlObj?.hostname ?? url,
    metaDescription: "",
    h1Tags: [],
    h2Tags: [],
    hasCTA: false,
    ctaText: [],
    hasForm: false,
    hasPhone: false,
    hasEmail: false,
    hasBookingLanguage: false,
    hasChatWidget: false,
    hasTrustSignals: false,
    wordCount: 0,
    fullText: "",
    fetchFailed: true,
  };
}

// ─── Main grading entry point ─────────────────────────────────────────────────

export function gradeWebsite(pageData: PageData): GradeReport {
  // When the site could not be fetched, return a conservative neutral result
  // rather than penalizing a site that may simply block automated access.
  if (pageData.fetchFailed) {
    const categoryGrades = {
      website_conversion: "C" as Grade,
      search_visibility: "C" as Grade,
      paid_traffic_readiness: "C" as Grade,
      lead_capture: "C" as Grade,
    };
    return {
      overall_grade: "C",
      category_grades: categoryGrades,
      headline: generateHeadline("C"),
      top_insights: [
        { category: "general", text: "Our diagnostic encountered limited access to the page, which may affect the precision of this score." },
        { category: "general", text: "Conversion clarity and trust-building signals could not be fully verified — these are typically among the highest-impact revenue levers." },
        { category: "general", text: "The gap between potential traffic performance and actual lead capture is a common area where revenue is left on the table." },
      ],
      revenue_opportunity: "High",
      cta_title: "Get Your Full Revenue Activation Plan",
      cta_body:
        "This score surfaces the top-level signals. The full Revenue Activation Plan identifies exactly where revenue is being lost, which channels have the highest upside, and the specific actions that will move the needle fastest.",
    };
  }

  const website_conversion = scoreWebsiteConversion(pageData);
  const search_visibility = scoreSearchVisibility(pageData);
  const paid_traffic_readiness = scorePaidTrafficReadiness(pageData);
  const lead_capture = scoreLeadCapture(pageData);

  const categoryGrades = {
    website_conversion,
    search_visibility,
    paid_traffic_readiness,
    lead_capture,
  };

  const overall_grade = computeOverallGrade(categoryGrades);
  const headline = generateHeadline(overall_grade);
  const top_insights = generateTopInsights(pageData, categoryGrades);
  const revenue_opportunity = determineRevenueOpportunity(overall_grade, categoryGrades);

  return {
    overall_grade,
    category_grades: categoryGrades,
    headline,
    top_insights,
    revenue_opportunity,
    cta_title: "Get Your Full Revenue Activation Plan",
    cta_body:
      "This score surfaces the top-level signals. The full Revenue Activation Plan identifies exactly where revenue is being lost, which channels have the highest upside, and the specific actions that will move the needle fastest.",
  };
}
