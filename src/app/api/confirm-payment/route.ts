import { NextRequest, NextResponse } from "next/server";
import { checkAvailability, createCalendarEvent } from "@/lib/googleCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { orlandoToDate, horaPadrao } from "@/lib/time";
import { enfileirarMensagem } from "@/lib/mensagens";
import { idiomaDe, textoPagamento } from "@/lib/mensagensTextos";

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

    const hora: string = orcamento.hora_inicio || horaPadrao(orcamento.periodo_escolhido);
    const start = orlandoToDate(orcamento.data_escolhida, hora);
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

    const { data: novoAg, error: insertError } = await supabaseAdmin
      .from("agendamentos")
      .insert({
        orcamento_id: orcamentoId,
        data_hora: start.toISOString(),
        google_event_id: eventId,
        status: "confirmado",
      })
      .select("id")
      .single();

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

    // Em vez de mandar pelo WhatsApp, a mensagem vai pra fila do painel (a dona envia por SMS)
    try {
      await enfileirarMensagem({
        tipo: "pagamento",
        nome: orcamento.nome_cliente,
        telefone: orcamento.telefone,
        idioma: idiomaDe(orcamento.idioma),
        texto: textoPagamento({
          data: orcamento.data_escolhida,
          hora,
          idioma: idiomaDe(orcamento.idioma),
        }),
        orcamentoId,
        agendamentoId: novoAg?.id ?? null,
        chave: `pagamento:${orcamentoId}`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: `Agendado, mas ${message}`, scheduled: true }, { status: 500 });
    }

    return NextResponse.json({ success: true, eventId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Unexpected error: ${message}` }, { status: 500 });
  }
}