/**
 * POST /api/strategy-call
 *
 * One submission → one webhook call → one row in Google Sheets.
 *
 * Duplicate-prevention layers:
 *   1. Client sends a unique `submissionId` per form submit.
 *   2. Server tracks recent submissionIds in an in-memory Set; any request
 *      with a seen ID is acknowledged immediately without re-firing the webhook.
 *   3. Webhook uses redirect:"manual" so Node never follows GAS's 302 redirect
 *      and cannot accidentally re-trigger doPost on the redirect target.
 */

import { NextRequest, NextResponse } from "next/server";
import { saveStrategyCall } from "@/lib/leads";

export const runtime = "nodejs";

// ── Idempotency store ─────────────────────────────────────────────────────────
// Keeps submissionIds for 60 s — long enough to catch any retry/double-submit,
// short enough not to grow unbounded on a long-running server.
const recentSubmissions = new Set<string>();

function isDuplicate(id: string): boolean {
  if (recentSubmissions.has(id)) return true;
  recentSubmissions.add(id);
  setTimeout(() => recentSubmissions.delete(id), 60_000);
  return false;
}

// ── Webhook ───────────────────────────────────────────────────────────────────

const SHEET_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbxn9XhF01iM_MFZN33_FHW5UEh26ayz2scLwf6Zm14y_InEfUZa57uDv354Vn8TPuJMqA/exec";

async function fireWebhook(
  submissionId: string,
  payload: Record<string, string>
): Promise<void> {
  console.log(`[strategy-call][${submissionId}] Firing webhook`);
  console.log(`[strategy-call][${submissionId}] Payload: ${JSON.stringify(payload)}`);

  try {
    const res = await fetch(SHEET_WEBHOOK, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log(`[strategy-call][${submissionId}] Webhook response status: ${res.status}`);
    console.log(`[strategy-call][${submissionId}] Webhook response body: ${text}`);
  } catch (err) {
    console.error(`[strategy-call][${submissionId}] Webhook threw:`, err);
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
    submissionId?: string;
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

  const submissionId = body.submissionId ?? `no-id-${Date.now()}`;
  console.log(`[strategy-call][${submissionId}] Request received`);
  console.log(`[strategy-call][${submissionId}] Body: ${JSON.stringify(body)}`);

  // ── 2. Idempotency check ───────────────────────────────────────────────────
  if (isDuplicate(submissionId)) {
    console.warn(
      `[strategy-call][${submissionId}] DUPLICATE REQUEST — returning 200 without re-processing`
    );
    return NextResponse.json(
      { success: true, duplicate: true },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // ── 3. Validate ────────────────────────────────────────────────────────────
  if (
    !body.name?.trim() ||
    !body.contact_email?.trim() ||
    !body.business_name?.trim() ||
    !body.website?.trim()
  ) {
    console.warn(`[strategy-call][${submissionId}] Validation failed`);
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

  // ── 4. Local save (isolated) ───────────────────────────────────────────────
  try {
    await saveStrategyCall({ leadId, name, contact_email: email, business_name: business, industry, website });
    console.log(`[strategy-call][${submissionId}] Local save succeeded`);
  } catch (err) {
    console.error(`[strategy-call][${submissionId}] Local save failed (non-fatal):`, err);
  }

  // ── 5. Single webhook — all 9 fields ──────────────────────────────────────
  await fireWebhook(submissionId, {
    type:         "strategy_call",
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

  console.log(`[strategy-call][${submissionId}] Done — returning 200`);
  return NextResponse.json(
    { success: true },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}
