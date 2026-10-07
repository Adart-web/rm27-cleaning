import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { supabaseAdmin } from "./supabaseAdmin";
import { orlandoToDate } from "./time";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const TZ = "America/New_York";

function usaContaDeServico(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );
}

function getCalendarId(): string {
  if (!usaContaDeServico()) return "primary";
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) {
    throw new Error("GOOGLE_CALENDAR_ID is required when using the service account");
  }
  return id;
}

async function getOAuthClient() {
  const { data } = await supabaseAdmin
    .from("configuracoes")
    .select("valor")
    .eq("chave", "google_calendar_tokens")
    .single();

  if (!data) {
    throw new Error("Google Calendar not connected yet");
  }

  const tokens = JSON.parse(data.valor);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await supabaseAdmin.from("configuracoes").upsert(
      {
        chave: "google_calendar_tokens",
        valor: JSON.stringify(merged),
      },
      { onConflict: "chave" }
    );
  });

  return oauth2Client;
}

async function getCalendar() {
  if (usaContaDeServico()) {
    console.log("[calendar] auth=service-account");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY as string).replace(/\\n/g, "\n"),
      scopes: SCOPES,
    });
    return google.calendar({ version: "v3", auth });
  }
  console.log("[calendar] auth=oauth");
  const auth = await getOAuthClient();
  return google.calendar({ version: "v3", auth });
}

function getBusy(data: calendar_v3.Schema$FreeBusyResponse, id: string) {
  const cal = data.calendars?.[id];
  if (!cal) {
    throw new Error("Calendar not found in freebusy response");
  }
  if (cal.errors && cal.errors.length > 0) {
    throw new Error(
      `Calendar error: ${cal.errors.map((e) => e.reason).join(", ")}`
    );
  }
  return cal.busy || [];
}

export async function checkAvailability(startISO: string, endISO: string) {
  const calendar = await getCalendar();
  const id = getCalendarId();

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id }],
    },
  });

  return getBusy(res.data, id).length === 0;
}

export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
}) {
  const calendar = await getCalendar();

  const res = await calendar.events.insert({
    calendarId: getCalendarId(),
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO, timeZone: TZ },
      end: { dateTime: params.endISO, timeZone: TZ },
    },
  });

  return res.data.id;
}

export async function deleteCalendarEvent(eventId: string) {
  const calendar = await getCalendar();
  try {
    await calendar.events.delete({
      calendarId: getCalendarId(),
      eventId,
    });
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 404 || code === 410) return; // já foi apagado
    throw e;
  }
}

export async function getMonthAvailability(
  year: number,
  month: number
): Promise<Record<string, { manha: boolean; tarde: boolean }>> {
  const calendar = await getCalendar();
  const id = getCalendarId();

  const mm = String(month).padStart(2, "0");
  const totalDias = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: orlandoToDate(`${year}-${mm}-01`, "00:00").toISOString(),
      timeMax: orlandoToDate(
        `${year}-${mm}-${String(totalDias).padStart(2, "0")}`,
        "23:59"
      ).toISOString(),
      items: [{ id }],
    },
  });

  const busy = getBusy(res.data, id).map((b) => ({
    start: new Date(b.start!),
    end: new Date(b.end!),
  }));

  const conflita = (start: Date, end: Date) =>
    busy.some((b) => start < b.end && end > b.start);

  const result: Record<string, { manha: boolean; tarde: boolean }> = {};
  const agora = new Date();

  for (let d = 1; d <= totalDias; d++) {
    const dd = String(d).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;

    // não atende domingo
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) continue;

    const manhaIni = orlandoToDate(dateStr, "08:00");
    const manhaFim = orlandoToDate(dateStr, "12:00");
    const tardeIni = orlandoToDate(dateStr, "13:00");
    const tardeFim = orlandoToDate(dateStr, "17:00");

    const manhaLivre = manhaFim > agora && !conflita(manhaIni, manhaFim);
    const tardeLivre = tardeFim > agora && !conflita(tardeIni, tardeFim);

    if (manhaLivre || tardeLivre) {
      result[dateStr] = { manha: manhaLivre, tarde: tardeLivre };
    }
  }

  return result;
}