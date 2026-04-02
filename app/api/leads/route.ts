/**
 * POST /api/leads
 *
 * Called when a user submits their email at the gate.
 * Saves the lead and returns a `leadId` that the client stores in state
 * so the strategy call form can reference it.
 */

import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/leads";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: {
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
        { error: "Invalid JSON body" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!body.email || !body.domain) {
      return NextResponse.json(
        { error: "email and domain are required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const leadId = await saveLead({
      email: body.email,
      domain: body.domain,
      submitted_url: body.submitted_url ?? "",
      overall_grade: body.overall_grade ?? "",
      category_grades: body.category_grades ?? {},
      revenue_opportunity: body.revenue_opportunity ?? "",
    });

    return NextResponse.json(
      { success: true, leadId },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[/api/leads] Error:", err);
    return NextResponse.json(
      { error: "Failed to save lead" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}
