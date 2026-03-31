import { NextRequest, NextResponse } from "next/server";
import {
  extractPageData,
  generateFallbackPageData,
  gradeWebsite,
  type GradeReport,
} from "@/lib/grader";

export const runtime = "nodejs";
export const maxDuration = 30;

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SpeedXGrader/1.0; +https://speedx.io)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWebsite(
  url: string
): Promise<{ html: string; success: boolean }> {
  try {
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) {
      return { html: "", success: false };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/")) {
      return { html: "", success: false };
    }

    // Limit to first 500KB to avoid memory issues
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sliced = bytes.slice(0, 500 * 1024);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(sliced);

    return { html, success: true };
  } catch (error) {
    console.error("Fetch error:", error);
    return { html: "", success: false };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers }
      );
    }

    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid url field" },
        { status: 400, headers }
      );
    }

    const normalizedUrl = normalizeUrl(body.url);

    if (!isValidUrl(normalizedUrl)) {
      return NextResponse.json(
        { error: "Invalid URL provided" },
        { status: 400, headers }
      );
    }

    // Fetch the website
    const { html, success } = await fetchWebsite(normalizedUrl);

    let pageData;
    if (success && html.length > 0) {
      pageData = extractPageData(normalizedUrl, html, false);
    } else {
      // Fallback analysis
      pageData = generateFallbackPageData(normalizedUrl);
    }

    const report: GradeReport = gradeWebsite(pageData);

    // Add the analyzed URL to the response
    const responsePayload = {
      ...report,
      analyzed_url: normalizedUrl,
      fetch_success: success,
    };

    return NextResponse.json(responsePayload, { status: 200, headers });
  } catch (error) {
    console.error("Grade API error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred while analyzing the website.",
        details:
          process.env.NODE_ENV === "development"
            ? String(error)
            : undefined,
      },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
