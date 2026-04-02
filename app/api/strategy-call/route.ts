/**
 * POST /api/strategy-call
 *
 * Saves the strategy call locally and fires ONE webhook to Google Sheets
 * containing all fields: name, email, business, website + utm_*.
 *
 * One submission → one webhook call → one row.
 */

import { NextRequest, NextResponse } from "next/server";
import { saveStrategyCall } from "@/lib/leads";

export const runtime = "nodejs";

// ── Single webhook endpoint ───────────────────────────────────────────────────
// Contains all fields: name / email / business / website / utm_*
const SHEET_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbxyhGMnwjqL3JEG8mvjzrfgHN5GXz4WS8Nrc32byAqtzBEwrZWW1_pS2OsZvbzzXL3M/exec";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fireWebhook(payload: Record<string, string>): Promise<void> {
  console.log("[strategy-call] Firing webhook — payload:", JSON.stringify(payload));
  try {
    const res = await fetch(SHEET_WEBHOOK, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[strategy-call] Webhook response — status: ${res.status}, body: ${text}`);
    if (!res.ok) {
      console.error(`[strategy-call] Webhook returned non-OK ${res.status}: ${text}`);
    }
  } catch (err) {
    console.error("[strategy-call] Webhook threw:", err);
  }
}

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse ───────────────────────────────────────────────────────────────
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

  console.log("[strategy-call] Request received:", JSON.stringify(body));

  // ── 2. Validate ────────────────────────────────────────────────────────────
  if (
    !body.name?.trim() ||
    !body.contact_email?.trim() ||
    !body.business_name?.trim() ||
    !body.website?.trim()
  ) {
    console.warn("[strategy-call] Validation failed — missing required fields");
    return NextResponse.json(
      { error: "name, contact_email, business_name, and website are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const name     = body.name.trim();
  const email    = body.contact_email.trim();
  const business = body.business_name.trim();
  const website  = body.website.trim();
  const industry = body.industry?.trim() ?? "";
  const leadId   = body.leadId ?? null;

  // ── 3. Local save (isolated — never blocks the response) ──────────────────
  try {
    await saveStrategyCall({
      leadId,
      name,
      contact_email: email,
      business_name: business,
      industry,
      website,
    });
    console.log("[strategy-call] Local save succeeded");
  } catch (err) {
    console.error("[strategy-call] Local save failed (non-fatal):", err);
  }

  // ── 4. Single webhook — all 9 fields in one row ───────────────────────────
  await fireWebhook({
    name,
    email,
    business,
    website,
    utm_source:   body.utm_source   ?? "",
    utm_medium:   body.utm_medium   ?? "",
    utm_campaign: body.utm_campaign ?? "",
    utm_term:     body.utm_term     ?? "",
    utm_content:  body.utm_content  ?? "",
  });

  // ── 5. Return success ──────────────────────────────────────────────────────
  console.log("[strategy-call] Done — returning 200");
  return NextResponse.json(
    { success: true },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}
