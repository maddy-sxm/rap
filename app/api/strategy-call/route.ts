/**
 * POST /api/strategy-call
 *
 * Called when a user submits the "Request a Strategy Call" modal form.
 * Saves the strategy call record, optionally linked to the original gate
 * lead via `leadId`, and fires two webhooks:
 *   1. STRATEGY_WEBHOOK — original lead/form data
 *   2. UTM_WEBHOOK      — lead data + UTM attribution fields
 */

import { NextRequest, NextResponse } from "next/server";
import { saveStrategyCall } from "@/lib/leads";

export const runtime = "nodejs";

// ── Webhook endpoints ─────────────────────────────────────────────────────────

/** Original strategy call webhook (name / email / business / website) */
const STRATEGY_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbxrtQ8u6a9x7AsF9Lu44OtLOsnJKaOFC23pLQ6GxtnN4asy7fDMEz8Yw6xaLENL20qFJA/exec";

/** UTM attribution webhook (same lead fields + utm_* params) */
const UTM_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbxyhGMnwjqL3JEG8mvjzrfgHN5GXz4WS8Nrc32byAqtzBEwrZWW1_pS2OsZvbzzXL3M/exec";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fireWebhook(url: string, payload: Record<string, string>): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[/api/strategy-call] Webhook failed (${url}):`, err);
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
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

    if (!body.name || !body.contact_email || !body.business_name) {
      return NextResponse.json(
        { error: "name, contact_email, and business_name are required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Normalise UTM fields — always strings, never undefined
    const utms = {
      utm_source:   body.utm_source   ?? "",
      utm_medium:   body.utm_medium   ?? "",
      utm_campaign: body.utm_campaign ?? "",
      utm_term:     body.utm_term     ?? "",
      utm_content:  body.utm_content  ?? "",
    };

    // Save locally
    await saveStrategyCall({
      leadId:        body.leadId ?? null,
      name:          body.name,
      contact_email: body.contact_email,
      business_name: body.business_name,
      industry:      body.industry ?? "",
      website:       body.website  ?? "",
    });

    // Fire both webhooks in parallel — neither blocks the response if it fails
    await Promise.all([
      fireWebhook(STRATEGY_WEBHOOK, {
        name:     body.name,
        email:    body.contact_email,
        business: body.business_name,
        website:  body.website ?? "",
      }),
      fireWebhook(UTM_WEBHOOK, {
        name:     body.name,
        email:    body.contact_email,
        business: body.business_name,
        website:  body.website ?? "",
        ...utms,
      }),
    ]);

    return NextResponse.json(
      { success: true },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[/api/strategy-call] Error:", err);
    return NextResponse.json(
      { error: "Failed to save strategy call request" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}
