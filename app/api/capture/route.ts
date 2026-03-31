import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, url, report } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400, headers: CORS });
    }

    // Log the lead capture — replace with CRM/email integration in production
    console.log("[LEAD]", {
      email: email.trim().toLowerCase(),
      url: url ?? "",
      overall_grade: report?.overall_grade ?? null,
      revenue_opportunity: report?.revenue_opportunity ?? null,
      captured_at: new Date().toISOString(),
    });

    // TODO: Integrate with CRM or email service (e.g., HubSpot, Klaviyo, ActiveCampaign)
    // await sendToCRM({ email, url, report });

    return NextResponse.json({ success: true }, { status: 200, headers: CORS });
  } catch (err) {
    console.error("[CAPTURE ERROR]", err);
    return NextResponse.json({ error: "Capture failed" }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { status: 204, headers: CORS });
}
