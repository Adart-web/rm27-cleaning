import { google } from "googleapis";
import { supabaseAdmin } from "./supabaseAdmin";

async function getAuthorizedClient() {
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

export async function checkAvailability(startISO: string, endISO: string) {
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: "primary" }],
    },
  });

  const busy = res.data.calendars?.primary?.busy || [];
  return busy.length === 0;
}

export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
}) {
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO },
      end: { dateTime: params.endISO },
    },
  });

  return res.data.id;
}

export async function getAvailableSlots(dateStr: string): Promise<string[]> {
  // dateStr no formato YYYY-MM-DD
  const day = new Date(dateStr + "T00:00:00");

  // Não atende domingo
  if (day.getDay() === 0) return [];

  const businessHours = [9, 11, 13, 15]; // horários de início (2h por serviço)
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const dayStart = new Date(dateStr + "T00:00:00");
  const dayEnd = new Date(dateStr + "T23:59:59");

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: "primary" }],
    },
  });

  const busy = res.data.calendars?.primary?.busy || [];

  const slotsLivres: string[] = [];

  for (const hora of businessHours) {
    const slotStart = new Date(dateStr + "T00:00:00");
    slotStart.setHours(hora, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 2 * 60 * 60000);

    const conflita = busy.some((b) => {
      const busyStart = new Date(b.start!);
      const busyEnd = new Date(b.end!);
      return slotStart < busyEnd && slotEnd > busyStart;
    });

    if (!conflita && slotStart > new Date()) {
      slotsLivres.push(slotStart.toISOString());
    }
  }

  return slotsLivres;
}