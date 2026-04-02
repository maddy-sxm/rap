/**
 * POST /api/strategy-call
 *
 * Called when a user submits the "Request a Strategy Call" modal form.
 * Saves the strategy call record locally and fires two webhooks:
 *   1. STRATEGY_WEBHOOK — name / email / business / website
 *   2. UTM_WEBHOOK      — same fields + utm_* attribution params
 *
 * Design principle: validation failure returns 4xx; everything else
 * returns 200. Local-save and webhook errors are logged but never
 * surface as a 500 to the user — a sheet write failure should not
 * prevent the user from seeing the success state.
 */

import { NextRequest, NextResponse } from "next/server";
import { saveStrategyCall } from "@/lib/leads";

export const runtime = "nodejs";

// ── Webhook endpoints ─────────────────────────────────────────────────────────

const STRATEGY_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbxrtQ8u6a9x7AsF9Lu44OtLOsnJKaOFC23pLQ6GxtnN4asy7fDMEz8Yw6xaLENL20qFJA/exec";

const UTM_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbxyhGMnwjqL3JEG8mvjzrfgHN5GXz4WS8Nrc32byAqtzBEwrZWW1_pS2OsZvbzzXL3M/exec";

// ── Webhook helper ────────────────────────────────────────────────────────────

async function fireWebhook(
  label: string,
  url: string,
  payload: Record<string, string>
): Promise<void> {
  console.log(`[strategy-call] Firing ${label} webhook`);
  console.log(`[strategy-call] ${label} payload:`, JSON.stringify(payload));

  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",           // follow GAS 302 redirects transparently
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Always read the body so the connection is cleanly released
    const text = await res.text();

    console.log(`[strategy-call] ${label} response status: ${res.status}`);
    console.log(`[strategy-call] ${label} response body:`, text);

    if (!res.ok) {
      console.error(
        `[strategy-call] ${label} webhook returned non-OK status ${res.status}. Body: ${text}`
      );
    }
  } catch (err) {
    console.error(`[strategy-call] ${label} webhook threw:`, err);
  }
}

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: {
    name?: string;
    contact_email?: string;
    business_name?: string;
    industry?: string;
    website?: string;
    leadId?: string | null;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  console.log("[strategy-call] Received body:", JSON.stringify(body));

  // ── 2. Validate required fields ────────────────────────────────────────────
  if (!body.name?.trim() || !body.contact_email?.trim() || !body.business_name?.trim() || !body.website?.trim()) {
    console.warn("[strategy-call] Validation failed — missing required fields");
    return NextResponse.json(
      { error: "name, contact_email, business_name, and website are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Normalise all fields
  const name         = body.name.trim();
  const email        = body.contact_email.trim();
  const business     = body.business_name.trim();
  const website      = body.website.trim();
  const industry     = body.industry?.trim() ?? "";
  const leadId       = body.leadId ?? null;

  const utms = {
    utm_source:   body.utm_source   ?? "",
    utm_medium:   body.utm_medium   ?? "",
    utm_campaign: body.utm_campaign ?? "",
    utm_term:     body.utm_term     ?? "",
    utm_content:  body.utm_content  ?? "",
  };

  // ── 3. Local save (isolated — never blocks the response) ──────────────────
  try {
    await saveStrategyCall({ leadId, name, contact_email: email, business_name: business, industry, website });
    console.log("[strategy-call] Local save succeeded");
  } catch (err) {
    console.error("[strategy-call] Local save failed (non-fatal):", err);
  }

  // ── 4. Fire webhooks in parallel (both isolated) ──────────────────────────
  await Promise.all([
    fireWebhook("STRATEGY_WEBHOOK", STRATEGY_WEBHOOK, {
      name,
      email,
      business,
      website,
    }),
    fireWebhook("UTM_WEBHOOK", UTM_WEBHOOK, {
      name,
      email,
      business,
      website,
      ...utms,
    }),
  ]);

  // ── 5. Always return 200 once validation passes ───────────────────────────
  return NextResponse.json(
    { success: true },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}
