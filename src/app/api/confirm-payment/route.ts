import { NextRequest, NextResponse } from "next/server";
import { checkAvailability, createCalendarEvent } from "@/lib/googleCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { orcamentoId } = await request.json();

    const { data: orcamento, error: fetchError } = await supabaseAdmin
      .from("orcamentos")
      .select("*")
      .eq("id", orcamentoId)
      .single();

    if (fetchError || !orcamento) {
      return NextResponse.json({ error: `Quote not found: ${fetchError?.message}` }, { status: 404 });
    }

    if (!orcamento.data_escolhida || !orcamento.periodo_escolhido) {
      return NextResponse.json({ error: "Missing schedule fields" }, { status: 400 });
    }

    const horaInicio = orcamento.periodo_escolhido === "manha" ? 9 : 13;
    const start = new Date(orcamento.data_escolhida + "T00:00:00");
    start.setHours(horaInicio, 0, 0, 0);
    const end = new Date(start.getTime() + 120 * 60000);

    const disponivel = await checkAvailability(start.toISOString(), end.toISOString());
    if (!disponivel) {
      return NextResponse.json({ error: "Time slot no longer available" }, { status: 409 });
    }

    const eventId = await createCalendarEvent({
      summary: `RM27 Cleaning — ${orcamento.nome_cliente}`,
      description: orcamento.mensagem || "",
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    });

    const { error: insertError } = await supabaseAdmin.from("agendamentos").insert({
      orcamento_id: orcamentoId,
      data_hora: start.toISOString(),
      google_event_id: eventId,
      status: "confirmado",
    });

    if (insertError) {
      return NextResponse.json({ error: `Insert agendamento failed: ${insertError.message}` }, { status: 500 });
    }

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("orcamentos")
      .update({ status: "agendado" })
      .eq("id", orcamentoId)
      .select();

    if (updateError || !updateData || updateData.length === 0) {
      return NextResponse.json({ error: "Update orcamento failed" }, { status: 500 });
    }

    const dataFmt = start.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const periodoFmt = orcamento.periodo_escolhido === "manha" ? "Morning (8am-12pm)" : "Afternoon (1pm-5pm)";

    const texto = `Payment received! ✅

Your appointment with RM27 Cleaning is confirmed for:
${dataFmt} — ${periodoFmt}

We'll send a reminder closer to the date. Thank you!`;

    const waRes = await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({
          number: orcamento.telefone,
          text: texto,
        }),
      }
    );

    if (!waRes.ok) {
      const waBody = await waRes.text();
      return NextResponse.json({ error: `Scheduled OK but WhatsApp failed: ${waBody}`, scheduled: true }, { status: 500 });
    }

    return NextResponse.json({ success: true, eventId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Unexpected error: ${message}` }, { status: 500 });
  }
}