import { NextRequest, NextResponse } from "next/server";
import { checkAvailability, createCalendarEvent } from "@/lib/googleCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const { orcamentoId, dataHoraISO, duracaoMinutos = 120 } = await request.json();

  const start = new Date(dataHoraISO);
  const end = new Date(start.getTime() + duracaoMinutos * 60000);

  const disponivel = await checkAvailability(start.toISOString(), end.toISOString());

  if (!disponivel) {
    return NextResponse.json({ error: "Time slot is not available" }, { status: 409 });
  }

  const { data: orcamento } = await supabaseAdmin
    .from("orcamentos")
    .select("*")
    .eq("id", orcamentoId)
    .single();

  if (!orcamento) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const eventId = await createCalendarEvent({
    summary: `RM27 Cleaning — ${orcamento.tipo}`,
    description: orcamento.mensagem || "",
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  });

  await supabaseAdmin.from("agendamentos").insert({
    orcamento_id: orcamentoId,
    data_hora: start.toISOString(),
    google_event_id: eventId,
    status: "confirmado",
  });

  await supabaseAdmin
    .from("orcamentos")
    .update({ status: "agendado" })
    .eq("id", orcamentoId);

  return NextResponse.json({ success: true, eventId });
}