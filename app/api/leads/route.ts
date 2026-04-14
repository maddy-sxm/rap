/**
 * POST /api/leads
 *
 * Called when a user submits their email at the gate.
 * Fires the Google Sheets webhook (type:"hard_lead") and returns a
 * `leadId` that the client stores in state so the strategy call form
 * can reference it.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { saveLead } from '@/lib/leads';

export const runtime = 'nodejs';

const SHEET_WEBHOOK =
  'https://script.google.com/macros/s/AKfycbzAM0j6l0PF70JdG6pAgGMGeFsEv98FPTL2mnGyeVS1CTakVKycXkaNq8yjUxl-ElxV/exec';

const recentSubmissions = new Set<string>();

function isDuplicate(id: string): boolean {
  if (recentSubmissions.has(id)) return true;
  recentSubmissions.add(id);
  setTimeout(() => recentSubmissions.delete(id), 60_000);
  return false;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    submissionId?: string;
    email?: string;
    domain?: string;
    submitted_url?: string;
    overall_grade?: string;
    category_grades?: Record<string, string>;
    revenue_opportunity?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const submissionId = body.submissionId ?? `no-id-${Date.now()}`;
  console.log(
    `[leads][${submissionId}] Request received — email: ${body.email}`,
  );

  if (isDuplicate(submissionId)) {
    console.warn(`[leads][${submissionId}] DUPLICATE — skipping`);
    return NextResponse.json(
      { success: true, duplicate: true },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  if (!body.email || !body.domain) {
    return NextResponse.json(
      { error: 'email and domain are required' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const leadId = crypto.randomUUID();

  try {
    await saveLead({
      email: body.email,
      domain: body.domain,
      submitted_url: body.submitted_url ?? '',
      overall_grade: body.overall_grade ?? '',
      category_grades: body.category_grades ?? {},
      revenue_opportunity: body.revenue_opportunity ?? '',
    });
    console.log(`[leads][${submissionId}] Local save succeeded`);
  } catch (err) {
    console.error(
      `[leads][${submissionId}] Local save failed (non-fatal):`,
      err,
    );
  }

  const payload = {
    type: 'hard_lead',
    email: body.email,
    domain: body.domain,
    submitted_url: body.submitted_url ?? '',
    overall_grade: body.overall_grade ?? '',
    revenue_opportunity: body.revenue_opportunity ?? '',
  };

  console.log(
    `[leads][${submissionId}] Firing webhook — payload: ${JSON.stringify(payload)}`,
  );

  try {
    const res = await fetch(SHEET_WEBHOOK, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(
      `[leads][${submissionId}] Webhook status: ${res.status} — body: ${text}`,
    );
  } catch (err) {
    console.error(`[leads][${submissionId}] Webhook threw:`, err);
  }

  return NextResponse.json(
    { success: true, leadId },
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}
