import { NextRequest, NextResponse } from "next/server";
import { checkAvailability } from "@/lib/googleCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { orlandoToDate, horaPadrao } from "@/lib/time";
import { enfileirarMensagem } from "@/lib/mensagens";
import { idiomaDe, textoSinal } from "@/lib/mensagensTextos";

function extrairValor(mensagem: string): number {
  const match = mensagem.match(/Estimativa:\s*\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

export async function POST(request: NextRequest) {
  try {
    const { orcamentoId, horaInicio } = await request.json();

    const { data: orcamento, error: fetchError } = await supabaseAdmin
      .from("orcamentos")
      .select("*")
      .eq("id", orcamentoId)
      .single();

    if (fetchError || !orcamento) {
      return NextResponse.json({ error: `Quote not found: ${fetchError?.message}` }, { status: 404 });
    }

    if (!orcamento.data_escolhida) {
      return NextResponse.json({ error: "Pedido sem data escolhida" }, { status: 400 });
    }

    const hora: string = horaInicio || horaPadrao(orcamento.periodo_escolhido);
    const start = orlandoToDate(orcamento.data_escolhida, hora);
    const end = new Date(start.getTime() + 120 * 60000);

    const livre = await checkAvailability(start.toISOString(), end.toISOString());
    if (!livre) {
      return NextResponse.json(
        { error: "Esse horário já está ocupado no Google Calendar. Escolha outro." },
        { status: 409 }
      );
    }

    const valorTotal = extrairValor(orcamento.mensagem);
    // Em vez de mandar pelo WhatsApp, a mensagem vai pra fila do painel (a dona envia por SMS)
    await enfileirarMensagem({
      tipo: "sinal",
      nome: orcamento.nome_cliente,
      telefone: orcamento.telefone,
      idioma: idiomaDe(orcamento.idioma),
      texto: textoSinal({
        nome: orcamento.nome_cliente || "",
        data: orcamento.data_escolhida,
        hora,
        total: valorTotal,
        idioma: idiomaDe(orcamento.idioma),
      }),
      orcamentoId: orcamentoId,
      chave: `sinal:${orcamentoId}`,
    });

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("orcamentos")
      .update({ status: "aguardando_pagamento", hora_inicio: hora })
      .eq("id", orcamentoId)
      .select();

    if (updateError) {
      return NextResponse.json({ error: `Supabase update error: ${updateError.message}` }, { status: 500 });
    }

    if (!updateData || updateData.length === 0) {
      return NextResponse.json({ error: "Update ran but no row was changed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Unexpected error: ${message}` }, { status: 500 });
  }
}