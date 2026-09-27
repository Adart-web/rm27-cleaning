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
  } catch (e) {
    return NextResponse.json({ error: "Could not load availability" }, { status: 500 });
  }
}