/**
 * POST /api/soft-lead
 *
 * Fires once when a user submits a website URL for testing.
 * Sends { type:"soft_lead", website, utm_* } to the Google Sheets webhook.
 *
 * The GAS script routes to the "Soft Leads" tab based on type:"soft_lead".
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SHEET_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbwylUXPs3O38ItVnZJw9xph_5q4JXgvxjLiRd5csoOsRZm1eBd_UMRpvHcf1HoeyGAyEw/exec";

// ── Idempotency ───────────────────────────────────────────────────────────────
const recentSubmissions = new Set<string>();

function isDuplicate(id: string): boolean {
  if (recentSubmissions.has(id)) return true;
  recentSubmissions.add(id);
  setTimeout(() => recentSubmissions.delete(id), 60_000);
  return false;
}

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    submissionId?: string;
    website?: string;
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
  console.log(`[soft-lead][${submissionId}] Request received — website: ${body.website}`);

  // Idempotency — reject duplicate fires within 60 s
  if (isDuplicate(submissionId)) {
    console.warn(`[soft-lead][${submissionId}] DUPLICATE — skipping`);
    return NextResponse.json(
      { success: true, duplicate: true },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  if (!body.website?.trim()) {
    return NextResponse.json(
      { error: "website is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const payload = {
    type:         "soft_lead",
    website:      body.website.trim(),
    utm_source:   body.utm_source   ?? "",
    utm_medium:   body.utm_medium   ?? "",
    utm_campaign: body.utm_campaign ?? "",
    utm_term:     body.utm_term     ?? "",
    utm_content:  body.utm_content  ?? "",
  };

  console.log(`[soft-lead][${submissionId}] Firing webhook — payload: ${JSON.stringify(payload)}`);

  try {
    const res = await fetch(SHEET_WEBHOOK, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[soft-lead][${submissionId}] Webhook status: ${res.status} — body: ${text}`);
  } catch (err) {
    console.error(`[soft-lead][${submissionId}] Webhook threw:`, err);
  }

  return NextResponse.json(
    { success: true },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}
