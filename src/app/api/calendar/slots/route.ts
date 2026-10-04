import { NextRequest, NextResponse } from "next/server";
import { getMonthAvailability } from "@/lib/googleCalendar";

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get("year");
  const month = request.nextUrl.searchParams.get("month");

  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  try {
    const availability = await getMonthAvailability(Number(year), Number(month));
    return NextResponse.json({ availability });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("CALENDAR ERROR:", message);
    return NextResponse.json({ error: `Could not load availability: ${message}` }, { status: 500 });
  }
}